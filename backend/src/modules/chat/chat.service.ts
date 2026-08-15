import { ChatChannelType, UserRole } from '@prisma/client';
import prisma from '../../config/database';
import { io } from '../../app';
import { notificationService } from '../../services/notification.service';
import { ForbiddenError, NotFoundError, UnprocessableError } from '../../utils/errors';

/**
 * Who chat exists for.
 *
 * SUPER_USER is a platform administrator, not a member of any one
 * association — the same reasoning that keeps them out of a tenant's
 * payment history in the audit trail keeps them out of residents'
 * conversations here. GATE_STAFF are usually contracted and share a
 * handset; an inbox that could show one guard's messages to the next
 * shift is a leak by design, not an accident. Both are excluded at the
 * data layer (the directory never lists them, channel creation rejects
 * them), not merely hidden in the UI.
 */
const CHAT_ROLES: UserRole[] = [
  UserRole.RESIDENT, UserRole.COMMITTEE, UserRole.TREASURER, UserRole.MANAGER,
];

const MAX_MESSAGE_LENGTH = 4000;

export interface SendMessageBody {
  content: string;
}

export interface CreateGroupBody {
  name: string;
  member_ids: string[];
}

class ChatService {
  // ── Directory ────────────────────────────────────────────────────────────

  /** Everyone in the association a resident is allowed to start a chat with. */
  async directory(associationId: string, excludeUserId: string) {
    const users = await prisma.user.findMany({
      where: {
        association_id: associationId,
        role: { in: CHAT_ROLES },
        is_active: true,
        deleted_at: null,
        id: { not: excludeUserId },
      },
      select: {
        id: true, name: true, role: true,
        unit: { select: { flat_number: true, block: true } },
      },
      orderBy: { name: 'asc' },
    });
    return { data: users };
  }

  // ── Channel list ─────────────────────────────────────────────────────────

  async listChannels(associationId: string, userId: string) {
    const memberships = await prisma.chatChannelMember.findMany({
      where: { user_id: userId, channel: { association_id: associationId } },
      include: {
        channel: {
          include: {
            members: {
              include: { user: { select: { id: true, name: true, role: true } } },
            },
            messages: {
              where: { deleted_at: null },
              orderBy: { created_at: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { channel: { last_message_at: 'desc' } },
    });

    const rows = await Promise.all(memberships.map(async (m) => {
      const unread = await prisma.chatMessage.count({
        where: {
          channel_id: m.channel_id,
          created_at: { gt: m.last_read_at },
          sender_id: { not: userId },
          deleted_at: null,
        },
      });
      const other = m.channel.type === ChatChannelType.DIRECT
        ? m.channel.members.find((mm) => mm.user_id !== userId)?.user
        : null;
      const last = m.channel.messages[0];

      return {
        id: m.channel.id,
        type: m.channel.type,
        // A direct channel has no name of its own — the other person is the
        // name, resolved here rather than stored, so it never goes stale.
        name: m.channel.type === ChatChannelType.DIRECT ? (other?.name ?? 'Former member') : m.channel.name,
        other_user: other ? { id: other.id, name: other.name, role: other.role } : null,
        member_count: m.channel.members.length,
        last_message: last ? { content: last.content, sender_id: last.sender_id, created_at: last.created_at } : null,
        last_message_at: m.channel.last_message_at,
        unread_count: unread,
      };
    }));

    return { data: rows };
  }

  // ── Direct messages ──────────────────────────────────────────────────────

  /** Idempotent: two people only ever share one direct channel. */
  async getOrCreateDirectChannel(associationId: string, meId: string, otherId: string) {
    if (meId === otherId) throw new UnprocessableError('You cannot message yourself.');

    const other = await prisma.user.findFirst({
      where: { id: otherId, association_id: associationId, role: { in: CHAT_ROLES }, is_active: true, deleted_at: null },
      select: { id: true },
    });
    if (!other) throw new NotFoundError('That person is not available to chat.');

    const existing = await prisma.chatChannel.findFirst({
      where: {
        association_id: associationId,
        type: ChatChannelType.DIRECT,
        AND: [
          { members: { some: { user_id: meId } } },
          { members: { some: { user_id: otherId } } },
        ],
      },
      select: { id: true },
    });
    if (existing) return { data: { id: existing.id, created: false } };

    const channel = await prisma.chatChannel.create({
      data: {
        association_id: associationId,
        type: ChatChannelType.DIRECT,
        created_by: meId,
        members: { create: [{ user_id: meId }, { user_id: otherId }] },
      },
      select: { id: true },
    });
    return { data: { id: channel.id, created: true } };
  }

  // ── Group channels ───────────────────────────────────────────────────────

  async createGroup(associationId: string, meId: string, body: CreateGroupBody) {
    const name = (body.name ?? '').trim();
    if (!name) throw new UnprocessableError('A group needs a name.');
    if (name.length > 120) throw new UnprocessableError('Group name is too long.');

    const requested = Array.from(new Set((body.member_ids ?? []).filter((id) => id !== meId)));
    const eligible = await prisma.user.findMany({
      where: { id: { in: requested }, association_id: associationId, role: { in: CHAT_ROLES }, is_active: true, deleted_at: null },
      select: { id: true },
    });
    if (eligible.length === 0) {
      throw new UnprocessableError('Add at least one other person to start a group.');
    }

    const channel = await prisma.chatChannel.create({
      data: {
        association_id: associationId,
        type: ChatChannelType.GROUP,
        name,
        created_by: meId,
        members: {
          create: [{ user_id: meId }, ...eligible.map((u) => ({ user_id: u.id }))],
        },
      },
      select: { id: true },
    });
    return { data: { id: channel.id } };
  }

  /** Only the creator renames — a name every member could change churns constantly. */
  async renameGroup(channelId: string, meId: string, name: string) {
    const channel = await this.requireGroupOwnedBy(channelId, meId);
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new UnprocessableError('A group needs a name.');
    await prisma.chatChannel.update({ where: { id: channel.id }, data: { name: trimmed } });
    return { data: { ok: true } };
  }

  /** Any current member can add another eligible association member — the
   *  same posture WhatsApp groups use: whoever is already in can invite. */
  async addMember(associationId: string, channelId: string, meId: string, newUserId: string) {
    const channel = await this.requireGroupMember(channelId, meId);
    const target = await prisma.user.findFirst({
      where: { id: newUserId, association_id: associationId, role: { in: CHAT_ROLES }, is_active: true, deleted_at: null },
      select: { id: true },
    });
    if (!target) throw new NotFoundError('That person is not available to add.');

    await prisma.chatChannelMember.upsert({
      where: { channel_id_user_id: { channel_id: channel.id, user_id: newUserId } },
      update: {},
      create: { channel_id: channel.id, user_id: newUserId },
    });
    return { data: { ok: true } };
  }

  /** Removing someone else is the creator's call; anyone may remove themselves via leaveGroup. */
  async removeMember(channelId: string, meId: string, targetUserId: string) {
    const channel = await this.requireGroupOwnedBy(channelId, meId);
    if (targetUserId === meId) throw new UnprocessableError('Use "Leave group" to remove yourself.');
    await prisma.chatChannelMember.deleteMany({ where: { channel_id: channel.id, user_id: targetUserId } });
    return { data: { ok: true } };
  }

  async leaveGroup(channelId: string, meId: string) {
    const channel = await this.requireGroupMember(channelId, meId);
    await prisma.chatChannelMember.deleteMany({ where: { channel_id: channel.id, user_id: meId } });
    return { data: { ok: true } };
  }

  // ── Messages ─────────────────────────────────────────────────────────────

  async listMessages(channelId: string, meId: string, query: { cursor?: string; limit: number }) {
    await this.requireMember(channelId, meId);
    const take = Math.min(query.limit ?? 30, 100);

    const rows = await prisma.chatMessage.findMany({
      where: { channel_id: channelId },
      take,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { created_at: 'desc' },
      include: { sender: { select: { id: true, name: true } } },
    });

    return {
      data: rows.map((m) => ({
        id: m.id,
        sender: m.sender,
        // A deleted message keeps its slot in the thread — who said something
        // and when — but not what it said.
        content: m.deleted_at ? null : m.content,
        deleted: !!m.deleted_at,
        created_at: m.created_at,
      })),
      meta: { next_cursor: rows.length === take ? rows[rows.length - 1]!.id : null },
    };
  }

  async sendMessage(associationId: string, channelId: string, meId: string, senderName: string, body: SendMessageBody) {
    const channel = await this.requireMember(channelId, meId);

    const content = (body.content ?? '').trim();
    if (!content) throw new UnprocessableError('Message cannot be empty.');
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new UnprocessableError(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
    }

    const [message] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: { channel_id: channelId, sender_id: meId, content },
        include: { sender: { select: { id: true, name: true } } },
      }),
      prisma.chatChannel.update({ where: { id: channelId }, data: { last_message_at: new Date() } }),
      // Sending counts as having read up to now — a person is never told
      // they have unread messages consisting only of their own last word.
      prisma.chatChannelMember.update({
        where: { channel_id_user_id: { channel_id: channelId, user_id: meId } },
        data: { last_read_at: new Date() },
      }),
    ]);

    const payload = {
      id: message.id,
      channel_id: channelId,
      sender: message.sender,
      content: message.content,
      deleted: false,
      created_at: message.created_at,
    };
    io.to(`chat:channel:${channelId}`).emit('chat:message', payload);

    const otherMembers = await prisma.chatChannelMember.findMany({
      where: { channel_id: channelId, user_id: { not: meId } },
      select: { user_id: true },
    });
    if (otherMembers.length > 0) {
      await notificationService.dispatch({
        type: 'CHAT_MESSAGE',
        channels: ['PUSH'],
        recipients: otherMembers.map((m) => m.user_id),
        data: {
          channel_id: channelId,
          sender_name: senderName,
          preview: content.length > 120 ? `${content.slice(0, 117)}...` : content,
        },
      });
    }

    return { data: payload };
  }

  async markRead(channelId: string, meId: string) {
    await this.requireMember(channelId, meId);
    await prisma.chatChannelMember.update({
      where: { channel_id_user_id: { channel_id: channelId, user_id: meId } },
      data: { last_read_at: new Date() },
    });
    return { data: { ok: true } };
  }

  // ── Shared guards ────────────────────────────────────────────────────────

  private async requireMember(channelId: string, userId: string) {
    const channel = await prisma.chatChannel.findUnique({
      where: { id: channelId },
      select: { id: true, type: true, members: { where: { user_id: userId }, select: { id: true } } },
    });
    if (!channel || channel.members.length === 0) {
      throw new NotFoundError('Conversation');
    }
    return channel;
  }

  private async requireGroupMember(channelId: string, userId: string) {
    const channel = await this.requireMember(channelId, userId);
    if (channel.type !== ChatChannelType.GROUP) {
      throw new UnprocessableError('This only applies to group conversations.');
    }
    return channel;
  }

  private async requireGroupOwnedBy(channelId: string, userId: string) {
    const channel = await prisma.chatChannel.findUnique({
      where: { id: channelId },
      select: { id: true, type: true, created_by: true },
    });
    if (!channel) throw new NotFoundError('Conversation');
    if (channel.type !== ChatChannelType.GROUP) throw new UnprocessableError('This only applies to group conversations.');
    if (channel.created_by !== userId) throw new ForbiddenError('Only the person who created this group can do that.');
    return channel;
  }
}

export const chatService = new ChatService();

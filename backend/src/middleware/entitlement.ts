import { Response, NextFunction } from 'express';
import { ModuleKey } from '@prisma/client';
import { AuthRequest } from '../types';
import { AppError, UnauthorizedError } from '../utils/errors';
import { entitlementService, MODULE_CATALOG } from '../services/entitlement.service';

/**
 * 402 Payment Required — the association may not use this module, or may only
 * read it. Distinct from 403, which means the *user* lacks permission: the
 * difference matters because the fix is different. 403 is "ask your manager";
 * 402 is "your association needs to subscribe".
 */
export class PaymentRequiredError extends AppError {
  constructor(detail: string) {
    super(402, 'MODULE_NOT_SUBSCRIBED', 'Module not available', detail);
  }
}

/**
 * Server-side entitlement enforcement.
 *
 * Hiding a menu item is presentation. This is the authority — without it,
 * anyone who knows the URL has the module for free, and the subscription
 * model is decorative.
 *
 * Two strictnesses:
 *
 *   requireModule      — a lapsed association may still READ. Applied at the
 *                        router, so plain lists and detail screens keep
 *                        working: they can see their own data.
 *
 *   requireModuleFull  — FULL required whatever the method. Applied to
 *                        reports, statements, downloads and templates. These
 *                        are GETs, so without an explicit marker they would
 *                        slip through the read allowance, and producing a
 *                        Balance Sheet is the product, not a view of it.
 */
const deny = (module: ModuleKey, access: 'NONE' | 'READ_ONLY', trial: boolean, what: 'write' | 'output') => {
  const label = MODULE_CATALOG[module].name;

  if (access === 'NONE') {
    return new PaymentRequiredError(
      `The ${label} module is not part of your association's subscription. ` +
      `Contact SmartAppt to add it.`,
    );
  }

  // A trial that ran out and a subscription that lapsed are different
  // conversations. Saying "your subscription has ended" to someone who never
  // had one reads as a billing error and generates a support call.
  const ended = trial
    ? `Your ${label} trial has ended.`
    : `Your association's ${label} subscription has ended.`;

  return new PaymentRequiredError(
    what === 'output'
      ? `${ended} Your records remain visible, but reports and downloads need an active subscription.`
      : `${ended} Your records remain visible, but new entries cannot be made until it is renewed.`,
  );
};

const check = (module: ModuleKey, strict: boolean) =>
  async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) return next(new UnauthorizedError());

    try {
      const { access, wasTrial } = await entitlementService.accessDetailFor(
        req.user.association_id,
        module,
        req.user.role,
      );

      if (access === 'FULL') return next();
      if (access === 'NONE') return next(deny(module, 'NONE', wasTrial, 'write'));

      // READ_ONLY from here.
      if (strict) return next(deny(module, 'READ_ONLY', wasTrial, 'output'));

      const isRead = req.method === 'GET' || req.method === 'HEAD';
      if (isRead) return next();

      return next(deny(module, 'READ_ONLY', wasTrial, 'write'));
    } catch (err) {
      next(err);
    }
  };

/** Reads allowed when the subscription has lapsed. Use at the router. */
export const requireModule = (module: ModuleKey) => check(module, false);

/** Full access required regardless of method. Use on reports and downloads. */
export const requireModuleFull = (module: ModuleKey) => check(module, true);

/**
 * Dynamic bottom-tab navigator.
 * Tabs are built from the mobile config's menu_items map fetched after login.
 * Items not enabled by the Super User are hidden automatically.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../store';
import type { MobileConfig } from '../api/types';

import HomeScreen          from '../screens/HomeScreen';
import BillsScreen         from '../screens/BillsScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import MaintenanceScreen   from '../screens/MaintenanceScreen';
import VisitorsScreen      from '../screens/VisitorsScreen';
import JournalScreen       from '../screens/JournalScreen';
import LedgerScreen        from '../screens/LedgerScreen';
import PnLScreen           from '../screens/PnLScreen';
import BalanceSheetScreen  from '../screens/BalanceSheetScreen';
import MoreScreen          from '../screens/MoreScreen';

const Tab = createBottomTabNavigator();

const PRIMARY = '#0095db';

// Maps menu_item id → tab definition
interface TabDef {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  component: React.ComponentType<any>;
  itemId: string | null; // null = always shown (Home)
}

const ALL_TABS: TabDef[] = [
  { name: 'Home',          label: 'Home',          icon: 'home-outline',          component: HomeScreen,          itemId: null              },
  { name: 'Bills',         label: 'My Bills',      icon: 'receipt-outline',       component: BillsScreen,         itemId: 'dues_my_bills'   },
  { name: 'Announcements', label: 'Updates',       icon: 'megaphone-outline',     component: AnnouncementsScreen, itemId: 'announcements_feed' },
  { name: 'Maintenance',   label: 'Requests',      icon: 'construct-outline',     component: MaintenanceScreen,   itemId: 'maintenance_list'},
  { name: 'Visitors',      label: 'Visitors',      icon: 'people-outline',        component: VisitorsScreen,      itemId: 'visitors_log'    },
  { name: 'Journal',       label: 'Journal',       icon: 'book-outline',          component: JournalScreen,       itemId: 'journal_entries' },
  { name: 'Ledger',        label: 'Ledger',        icon: 'list-outline',          component: LedgerScreen,        itemId: 'ledger'          },
  { name: 'PnL',           label: 'P&L',           icon: 'trending-up-outline',   component: PnLScreen,           itemId: 'pnl'             },
  { name: 'BalanceSheet',  label: 'Balance',       icon: 'scale-outline',         component: BalanceSheetScreen,  itemId: 'balance_sheet'   },
  { name: 'More',          label: 'More',          icon: 'ellipsis-horizontal',   component: MoreScreen,          itemId: null              },
];

function isEnabled(itemId: string | null, cfg: MobileConfig | null): boolean {
  if (itemId === null) return true;  // always-on tabs
  if (!cfg?.menu_items) return true; // no config → show everything
  return cfg.menu_items[itemId]?.enabled ?? true;
}

// Show at most 4 feature tabs (+ Home) before collapsing the rest into "More"
const MAX_INLINE = 4;

export default function MainTabNavigator() {
  const mobileConfig = useAppSelector((s) => s.auth.mobileConfig);

  // Filter tabs based on enabled config
  const enabledFeatureTabs = ALL_TABS.filter(
    (t) => t.itemId !== null && t.name !== 'More' && isEnabled(t.itemId, mobileConfig)
  );

  // Inline: first MAX_INLINE feature tabs
  const inlineTabs = enabledFeatureTabs.slice(0, MAX_INLINE);
  // Overflow: any beyond MAX_INLINE go into "More"
  const overflowTabs = enabledFeatureTabs.slice(MAX_INLINE);

  // Always: Home + inline features + (More if there are overflows)
  const visibleTabs: TabDef[] = [
    ALL_TABS[0], // Home
    ...inlineTabs,
    ...(overflowTabs.length > 0 ? [ALL_TABS[ALL_TABS.length - 1]] : []), // More
  ];

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle:      { backgroundColor: '#fff' },
        headerTintColor:  '#0f172a',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        tabBarActiveTintColor:   PRIMARY,
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          backgroundColor: '#fff',
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
        tabBarIcon: ({ color, size, focused }) => {
          const tab = ALL_TABS.find((t) => t.name === route.name);
          const iconName = tab?.icon ?? 'ellipse-outline';
          return <Ionicons name={focused ? iconName.replace('-outline', '') as any : iconName} size={size} color={color} />;
        },
      })}
    >
      {visibleTabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.name === 'More' ? () => <MoreScreen overflowTabs={overflowTabs} /> : tab.component}
          options={{ tabBarLabel: tab.label, title: tab.label }}
        />
      ))}
    </Tab.Navigator>
  );
}

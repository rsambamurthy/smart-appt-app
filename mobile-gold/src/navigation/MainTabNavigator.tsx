/**
 * Dynamic bottom-tab navigator (same UX as SmartAppt Lite).
 * Tabs are built from the mobile config's menu_items map fetched after login —
 * items disabled by the Super User in the webapp's Mobile App Configuration
 * page are hidden automatically.
 *
 * Unlike Lite, ALL enabled screens are registered (overflow ones are hidden
 * from the tab bar) so navigating to them from "More" or Home tiles works.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../store';
import { isEnabled, type TabDef } from './menuConfig';

import HomeScreen             from '../screens/HomeScreen';
import MyBillsScreen          from '../screens/dues/MyBillsScreen';
import BillsScreen            from '../screens/dues/BillsScreen';
import AnnouncementsScreen    from '../screens/community/AnnouncementsScreen';
import MaintenanceScreen      from '../screens/community/MaintenanceScreen';
import VisitorsScreen         from '../screens/visitors/VisitorsScreen';
import JournalScreen          from '../screens/accounting/JournalScreen';
import LedgerScreen           from '../screens/accounting/LedgerScreen';
import PnLScreen              from '../screens/accounting/PnLScreen';
import BalanceSheetScreen     from '../screens/accounting/BalanceSheetScreen';
import FYClosureScreen        from '../screens/accounting/FYClosureScreen';
import COAScreen              from '../screens/accounting/COAScreen';
import BusinessPartnersScreen from '../screens/admin/BusinessPartnersScreen';
import MoreScreen             from '../screens/MoreScreen';

const Tab = createBottomTabNavigator();

const GOLD = '#7C3AED';

// Order matters: the first MAX_INLINE enabled feature tabs appear in the bar.
const FEATURE_TABS: TabDef[] = [
  { name: 'MyBills',          label: 'My Bills',  icon: 'receipt-outline',     component: MyBillsScreen,          itemId: 'dues_my_bills'      },
  { name: 'Announcements',    label: 'Updates',   icon: 'megaphone-outline',   component: AnnouncementsScreen,    itemId: 'announcements_feed' },
  { name: 'Maintenance',      label: 'Requests',  icon: 'construct-outline',   component: MaintenanceScreen,      itemId: 'maintenance_list'   },
  { name: 'Visitors',         label: 'Visitors',  icon: 'people-outline',      component: VisitorsScreen,         itemId: 'visitors_log'       },
  { name: 'Journal',          label: 'Journal',   icon: 'book-outline',        component: JournalScreen,          itemId: 'journal_entries'    },
  { name: 'Ledger',           label: 'Ledger',    icon: 'list-outline',        component: LedgerScreen,           itemId: 'ledger'             },
  { name: 'PnL',              label: 'P&L',       icon: 'trending-up-outline', component: PnLScreen,              itemId: 'pnl'                },
  { name: 'BalanceSheet',     label: 'Balance',   icon: 'scale-outline',       component: BalanceSheetScreen,     itemId: 'balance_sheet'      },
  { name: 'FYClosure',        label: 'FY Close',  icon: 'lock-closed-outline', component: FYClosureScreen,        itemId: 'fy_closure'         },
  { name: 'Bills',            label: 'All Bills', icon: 'albums-outline',      component: BillsScreen,            itemId: 'dues_bills'         },
  { name: 'COA',              label: 'Accounts',  icon: 'layers-outline',      component: COAScreen,              itemId: null                 },
  { name: 'BusinessPartners', label: 'Partners',  icon: 'briefcase-outline',   component: BusinessPartnersScreen, itemId: null                 },
];

const TITLES: Record<string, string> = {
  MyBills: 'My Bills', Announcements: 'Announcements', Maintenance: 'Service Requests',
  Visitors: 'Visitors', Journal: 'Journal Entries', Ledger: 'Ledger', PnL: 'P&L Report',
  BalanceSheet: 'Balance Sheet', FYClosure: 'FY Closure', Bills: 'All Bills',
  COA: 'Chart of Accounts', BusinessPartners: 'Business Partners', More: 'More', Home: 'Home',
};

// Show at most 4 feature tabs (+ Home + More) in the bottom bar
const MAX_INLINE = 4;

export default function MainTabNavigator() {
  const mobileConfig = useAppSelector(s => s.auth.mobileConfig);

  const enabledTabs  = FEATURE_TABS.filter(t => isEnabled(t.itemId, mobileConfig));
  const inlineNames  = new Set(enabledTabs.slice(0, MAX_INLINE).map(t => t.name));
  const overflowTabs = enabledTabs.slice(MAX_INLINE);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle:      { backgroundColor: '#fff' },
        headerTintColor:  '#1e1b4b',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
        tabBarActiveTintColor:   GOLD,
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#EDE9FE',
          backgroundColor: '#fff',
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
        tabBarIcon: ({ color, size, focused }) => {
          const tab = FEATURE_TABS.find(t => t.name === route.name);
          const iconName = route.name === 'Home' ? 'home-outline'
            : route.name === 'More' ? 'ellipsis-horizontal'
            : (tab?.icon ?? 'ellipse-outline');
          const solid = focused && iconName.endsWith('-outline')
            ? (iconName.replace('-outline', '') as keyof typeof Ionicons.glyphMap)
            : iconName;
          return <Ionicons name={solid as any} size={size} color={color} />;
        },
        title: TITLES[route.name] ?? route.name,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen}
        options={{ headerShown: false, tabBarLabel: 'Home' }} />

      {enabledTabs.map(tab => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarLabel: tab.label,
            title: TITLES[tab.name] ?? tab.label,
            // Overflow tabs stay registered (navigable) but hidden from the bar
            ...(inlineNames.has(tab.name) ? {} : { tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }),
          }}
        />
      ))}

      <Tab.Screen name="More" options={{ tabBarLabel: 'More', title: 'More' }}>
        {() => <MoreScreen overflowTabs={overflowTabs} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

/**
 * Card-based navigation:
 *   Home (category cards) → Category (section cards) → the section screen
 *
 * Replaces the old bottom-tab bar, which duplicated what the cards now do.
 * Every screen stays registered here regardless of config; visibility is
 * enforced by the cards (menuConfig), so a disabled section is simply never
 * reachable from the UI.
 */
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen             from '../screens/HomeScreen';
import CategoryScreen         from '../screens/CategoryScreen';
import MoreScreen             from '../screens/MoreScreen';
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

const Stack = createNativeStackNavigator();

const HEADER = {
  headerStyle:      { backgroundColor: '#fff' },
  headerTintColor:  '#7C3AED',
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 17, color: '#1e1b4b' },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: '#F5F3FF' },
};

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      {/* Level 1 — its own purple header card, so no navigation header */}
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />

      {/* Level 2 — title is set dynamically from the chosen category */}
      <Stack.Screen
        name="Category"
        component={CategoryScreen}
        options={({ route }: any) => ({ title: route.params?.title ?? 'Menu' })}
      />

      {/* Level 3 — the actual sections */}
      <Stack.Screen name="MyBills"          component={MyBillsScreen}          options={{ title: 'My Bills' }} />
      <Stack.Screen name="Announcements"    component={AnnouncementsScreen}    options={{ title: 'Announcements' }} />
      <Stack.Screen name="Maintenance"      component={MaintenanceScreen}      options={{ title: 'Service Requests' }} />
      <Stack.Screen name="Bills"            component={BillsScreen}            options={{ title: 'Bills & Payments' }} />
      <Stack.Screen name="Visitors"         component={VisitorsScreen}         options={{ title: 'Visitor Log' }} />
      <Stack.Screen name="Journal"          component={JournalScreen}          options={{ title: 'Journal Entries' }} />
      <Stack.Screen name="Ledger"           component={LedgerScreen}           options={{ title: 'Ledger' }} />
      <Stack.Screen name="PnL"              component={PnLScreen}              options={{ title: 'Profit & Loss' }} />
      <Stack.Screen name="BalanceSheet"     component={BalanceSheetScreen}     options={{ title: 'Balance Sheet' }} />
      <Stack.Screen name="FYClosure"        component={FYClosureScreen}        options={{ title: 'FY Closure' }} />
      <Stack.Screen name="COA"              component={COAScreen}              options={{ title: 'Chart of Accounts' }} />
      <Stack.Screen name="BusinessPartners" component={BusinessPartnersScreen} options={{ title: 'Business Partners' }} />

      {/* Account */}
      <Stack.Screen name="More" component={MoreScreen} options={{ title: 'Account' }} />
    </Stack.Navigator>
  );
}

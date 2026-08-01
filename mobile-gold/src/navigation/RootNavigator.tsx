import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '../store';
import MainNavigator from './MainNavigator';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const token = useAppSelector(s => s.auth.access_token);
  return (
    <NavigationContainer theme={{ dark: false, colors: { primary: '#7C3AED', background: '#F5F3FF', card: '#fff', text: '#1e1b4b', border: '#EDE9FE', notification: '#7C3AED' } }}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F3FF' } }}>
        {token ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <>
            <Stack.Screen name="Login"    component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

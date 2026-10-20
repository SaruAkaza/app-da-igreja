import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { ScreenRoute } from '../navigation/ScreenRoute';
import { RegisterScreen } from '../screens/RegisterScreen';
export default function Register() { const { user } = useAuth(); return user ? <Redirect href="/(app)/(tabs)/home" /> : <ScreenRoute screen={RegisterScreen} />; }

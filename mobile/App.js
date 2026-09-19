import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './src/screens/HomeScreen';
import ImportScreen from './src/screens/ImportScreen';
import EditorScreen from './src/screens/EditorScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Drive Live Preview' }} />
        <Stack.Screen name="Import" component={ImportScreen} options={{ title: 'Project Baru' }} />
        <Stack.Screen name="Editor" component={EditorScreen} options={{ title: 'Editor' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

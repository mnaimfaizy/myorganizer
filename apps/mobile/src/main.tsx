// First, before anything else imports React Native: the gesture handler
// installs its own touch pipeline at import time, and a component tree that
// mounted before it does not get it.
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import 'react-native-url-polyfill/auto';
import App from './app/App';

AppRegistry.registerComponent('Mobile', () => App);

import './App.scss'

import FileValidator from './components/FileValidator';
import jsonConfig from './AppConfig.jsonc?raw';
import { parse as parseJSONC} from 'jsonc-parser'

export function getAppConfig() {
  return parseJSONC(jsonConfig, undefined, { allowTrailingComma: true, disallowComments: false });
}

export default function App() {
  return (
    <FileValidator />
  );
}

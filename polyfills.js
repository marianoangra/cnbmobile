// Carregado ANTES de qualquer outro código no index.js.
// Necessário porque ESM hoista os imports — se a atribuição de
// `global.Buffer` ficasse no body do index.js, ela rodaria DEPOIS
// dos imports transitivos do App (que incluem @solana/web3.js, que
// já assume Buffer global no module-init).
//
// Aqui as atribuições estão no body de ESTE módulo, então rodam
// imediatamente quando o `import './polyfills'` do index.js termina,
// ANTES do próximo import dele.

import { Buffer } from 'buffer';
import 'react-native-get-random-values';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

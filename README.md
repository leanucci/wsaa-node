# wsaa-node

A Node.js client for AFIP's WSAA (Web Service de Autenticación y Autorización).

The client builds a login ticket request (TRA), signs it as a CMS (PKCS#7) message with your
certificate and private key, sends it to WSAA `loginCms`, and returns the TOKEN and the SIGN.
Other AFIP web services need these credentials.

See [`specs/`](specs/) for the features that this package implements.

## Install

```sh
npm install wsaa-node
```

The package needs Node.js 20 or later.

## Usage

```ts
import { WsaaClient, WsaaSoapFaultError } from "wsaa-node";

const client = new WsaaClient({
  environment: "testing", // or "production"
  certificatePath: process.env.AFIP_CERT_PATH,
  privateKeyPath: process.env.AFIP_KEY_PATH,
});

try {
  const { token, sign, expirationTime } = await client.login("wsfe");
  // Send token and sign to the target web service. Do not log them.
} catch (error) {
  if (error instanceof WsaaSoapFaultError) {
    console.error(error.faultCode, error.faultString);
  }
  throw error;
}
```

### Configuration

| Option            | Description                                                         |
| ----------------- | ------------------------------------------------------------------- |
| `environment`     | `"testing"` (homologación) or `"production"`.                       |
| `certificate`     | The client certificate, as PEM text.                                |
| `certificatePath` | The path to the client certificate PEM file.                        |
| `privateKey`      | The RSA private key, as unencrypted PEM text.                       |
| `privateKeyPath`  | The path to the RSA private key PEM file.                           |
| `fetch`           | Optional. A `fetch` function. The default is the global `fetch`.    |

Supply each item as PEM text or as a path, not both. The client never writes a certificate or a
private key to disk. Keep certificates and keys out of your repository.

### Endpoints

- Testing: `https://wsaahomo.afip.gov.ar/ws/services/LoginCms`
- Production: `https://wsaa.afip.gov.ar/ws/services/LoginCms`

### Errors

- `WsaaCredentialsError`: the certificate or the private key is missing, unreadable, not valid,
  or they do not match. The client raises it before it calls WSAA.
- `WsaaSoapFaultError`: WSAA returned a SOAP fault. It has `faultCode` and `faultString`.
- `WsaaResponseError`: the HTTP request failed, or the response is not valid or is expired.

No error message contains the private key, the TOKEN, or the SIGN.

## Development

```sh
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

This project uses the agent cycle. See [APPROACH.md](https://github.com/leanucci/portfolio/blob/main/APPROACH.md).

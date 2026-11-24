# 001: WSAA Client

- **Release:** minor
- **Human approval:** required

## Summary

This feature adds a client that authenticates with AFIP's WSAA (Web Service de Autenticación
y Autorización) service. The client builds a login ticket request, signs it with a client
certificate, sends it to WSAA, and returns the TOKEN and SIGN credentials. Other AFIP web
services need these credentials to prove the caller's identity.

## Requirements

1. The implementation follows AFIP's official WSAA Technical Specification (see Notes for the
   link). Read it before you write any code.
2. The client builds a login ticket request (TRA) for one target AFIP web service. The request
   has a unique identifier, a generation time, and an expiration time, as the specification
   defines them.
3. The client signs the login ticket request as a CMS (PKCS#7) message, using a client
   certificate and its matching private key.
4. The client sends the signed login ticket request to the WSAA `loginCms` service, for a
   testing environment or a production environment, chosen by configuration.
5. The client reads the TOKEN and the SIGN values, and their expiration time, from a successful
   response.
6. The client raises a clear error when WSAA returns a SOAP fault. The error includes the fault
   message from WSAA.
7. The client raises a clear error when the certificate or the private key is missing, unreadable,
   or does not match the request it signs.
8. The caller supplies the certificate and the private key as file paths or as PEM text, through
   configuration. The client never writes a certificate or a private key to disk.
9. The client does not log or expose the private key, the TOKEN, or the SIGN value in an error
   message or in any other output.

## Acceptance Criteria

1. Given a target web service name, when the client builds a login ticket request, then the
   request has a unique identifier, a generation time, and an expiration time that follow the
   specification's rules.
2. Given a login ticket request and a valid certificate and private key, when the client signs
   the request, then the result is a valid CMS (PKCS#7) message that WSAA accepts.
3. Given a signed login ticket request and the testing environment, when the client calls WSAA,
   then the client sends the request to the testing endpoint that the specification names.
4. Given a signed login ticket request and the production environment, when the client calls
   WSAA, then the client sends the request to the production endpoint that the specification
   names.
5. Given a successful WSAA response, when the client reads it, then the client returns the
   TOKEN, the SIGN, and the expiration time from that response.
6. Given a WSAA response with a SOAP fault, when the client reads it, then the client raises an
   error that includes the fault message.
7. Given a missing or unreadable certificate or private key, when the client tries to sign a
   request, then the client raises a clear error and makes no call to WSAA.
8. Given a certificate and a private key that do not match each other, when the client tries to
   sign a request, then the client raises a clear error and makes no call to WSAA.

## Out of Scope

- Caching or reusing a TOKEN and a SIGN across process runs. A future spec adds this.
- Scheduling an automatic refresh before a credential expires. A future spec adds this.
- Any other AFIP web service, for example WSFE (electronic invoicing). Those belong to other
  packages.
- A command-line interface. The client is a library only.

## Notes

- Official specification: [WSAA Technical Specification (PDF)](https://www.afip.gov.ar/ws/WSAA/Especificacion_Tecnica_WSAA_1.2.0.pdf).
  Read this document first. Use the exact endpoint URLs, XML structure, and timing rules that
  it defines. Do not guess them.
- `wsaa-ruby` (`/Users/lean/work/afip/ruby/wsaa-ruby`) is a Ruby port of the same client, built
  from the same specification. Use it as a behavioral reference when the specification leaves a
  choice open, but follow this spec's requirements first.
- This spec sets `Human approval: required` because it signs requests with a private key and
  calls an external government web service. The owner reviews it even after a passed review.

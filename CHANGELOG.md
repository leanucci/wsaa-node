# Changelog

All notable changes to this project are in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- README sections about the WSAA login cooldown and about credential persistence.

## [0.1.0] - 2026-11-24

### Added

- `WsaaClient`: a client for the AFIP WSAA `loginCms` service, for the testing and production environments.
- Build of the login ticket request (TRA) with a unique identifier, a generation time, and an expiration time.
- CMS (PKCS#7) SignedData signature of the TRA with SHA1+RSA and the client certificate.
- Read of the TOKEN, the SIGN, and the expiration time from the WSAA response.
- `WsaaSoapFaultError`, `WsaaCredentialsError`, and `WsaaResponseError` for clear errors.
- Load of the certificate and the private key from PEM text or from file paths.

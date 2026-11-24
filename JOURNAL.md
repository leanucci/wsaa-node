# Journal

A short entry for each merged pull request: the requirement and the key decisions.
The merge workflow adds each entry before it merges the pull request.

## 2026-11-24 — 001: WSAA Client

**Requirement:** A client that authenticates with AFIP's WSAA service. It builds a login
ticket request, signs it with a client certificate, sends it to WSAA, and returns the TOKEN
and SIGN credentials that other AFIP web services need.

**Decisions:** Used `node-forge` for CMS (PKCS#7) signing and `fast-xml-parser` for XML, since
the spec named neither library. The caller supplies the certificate and the private key as file
paths or as PEM text, through one configuration object. `login` computes one `now` value and
gives it to the request, the signer, and the expiry check, so tests stay deterministic. The
README documents AFIP's login cooldown (assume 10 minutes between successful logins for the
same certificate and service) and states that this package does not persist the TOKEN and the
SIGN; the caller must do that to avoid a lockout.

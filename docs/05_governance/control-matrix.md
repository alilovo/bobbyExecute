# Control Matrix / Tag 8

Status: active  
Artifact type: planning / governance control artifact  
Authority: derived from the Tag-8 Decision Lock, not a replacement for canonical truth  
Change rule: append-only updates only on explicit delta  
Boundary rule: no measures, no target architecture, no runtime invention

## Purpose

This artifact fixes the load-bearing control distinctions for later planning. It separates runtime basis, route entry metadata, service enforcement, and audit boundaries without turning any of them into a new SSOT.

## Fixed Control Trennungen

- `Principal`, `RequestContext`, `tenantId`, `userId`, and `Tenant` are fixed control prerequisites.
- `Role` is route-/guard-level entry metadata only.
- `Membership` is a mapping form, not a control prerequisite.
- Authorization remains separate from precondition.
- Audit remains separate from role authority and from runtime entry control.

## Control Matrix

| Kontrollfeld | Führende Begriffe | Was es trägt | Was es nicht trägt |
|---|---|---|---|
| Runtime-Basis | `Principal`, `RequestContext`, `tenantId`, `userId` | Actor- und Tenant-Basis im serverseitigen Pfad | Rollenrecht, fachliche Precondition, Nachweisraum |
| Isolationsrahmen | `Tenant`, `tenantId` | Mandantenbindung und harte Isolationsgrenze | Rollenentscheidung, Identitätsform, Audit |
| Eintrittsrahmen | `Role` | Route-/Guard-Eintritt auf API-Ebene | Laufzeitbasis, Membership, Service-Enforcement |
| Zuordnungsform | `Membership` | Verknüpfung von `User`, `Tenant` und `Role` | Policy-Entscheidung, Eintritt, Isolation selbst |
| Autorisierungsrahmen | Authorization | Eintrittsentscheidung an der Oberfläche | fachliche Precondition, Audit, Laufzeitschranke |
| Precondition-Rahmen | Precondition | fachliche Zulässigkeit eines konkreten Pfads | Rollenrecht, Tenant-Isolation, Nachweisraum |
| Abschluss- und Nachweisrahmen | Audit, Laufzeitschranke, Nachweisraum | transaktionale Abschlussgrenze und Belegraum | Rollenrecht, Autorisierung, fachliche Zulässigkeit |

## Load-Bearing Rules

1. Role and Tenant stay separate.
2. Identity and Role stay separate.
3. Membership never becomes a policy decision.
4. Authorization never becomes a precondition.
5. Route-Gate never becomes Service-Enforcement.
6. Audit / runtime stop never becomes role authority.

## Planning Use

This matrix is a reference artifact for later planning documents. It is descriptive and boundary-setting only. It does not define implementation, runtime behavior, or a future target architecture.

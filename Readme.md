# Secure Data Handling Project

Part 3: System Design & Incident Response
> Please provide a written document (Markdown) or a Diagram for the following scenarios:

Scenario A: Key Rotation Strategy
"We need to rotate our Data Encryption Keys (DEK) annually for compliance. However, we have millions of encrypted records in the database."
Question: Design a zero-downtime strategy to migrate these millions of records to the new key. How does the system know which key to use for decryption during the transition period? (Hint: Key Versioning).

Scenario B: Data Leak Incident Response
"A security audit reveals that a developer accidentally logged the 'Decrypted National ID' into our Cloud Logging system (e.g., CloudWatch/Stackdriver) for the past 24 hours."
Question: As a Tech Lead, what are your immediate actions? How do you remediate the leak, and what technical controls would you implement to prevent this from happening again?

---

Deliverables Checklist
1. Source Code:
   - /frontend-lib: TypeScript source code for the encryption library.
   - /backend: Python service code (Dockerized).
2. Documentation (README.md):
   - Instructions to run the project.
   - Deploy service on cloud service, e.g. Vercel
   - Your answers/designs for Scenario A (Key Rotation) and Scenario B (Data Leak).

# Firestore Security Specification - Fund Portal

## Data Invariants
1. **History Persistence**: Once a fund is archived to the `history` collection, it cannot be modified or deleted by standard users.
2. **Identification Integrity**: Document IDs in `history` must match the fund's `code`.
3. **Atomic Completion**: A checklist item can only be marked completed with a valid date.
4. **Verified Access**: Only users with verified emails from permitted domains (or general verified Google accounts for now) can perform writes.

## The "Dirty Dozen" Payloads (Denial Expected)

1. **Unauthorized Write**: Guest user attempting to write to `history`.
2. **History Tampering**: Signed-in user attempting to `update` an existing history record.
3. **History Deletion**: Signed-in user attempting to `delete` a historical record.
4. **ID Poisoning**: Attempting to create a history record with a 500kb string as the ID.
5. **Role Spoofing**: Attempting to update a checklist item as a different user (shadow update).
6. **Invalid Status**: marking a checklist item completed without a completion date.
7. **Future Listing**: Setting an `effectiveDate` in the year 2099.
8. **Missing Signatures**: Creating a history record without the mandatory `gmSign`.
9. **Duplicate ID Injection**: Attempting to overwrite a fund record with mismatched `code` and document ID.
10. **Global Wipe**: Attempting to list all history records without being signed in.
11. **Checklist Key Injection**: Adding a `isAdmin: true` field to a checklist item payload.
12. **Malicious Path**: Attempting to write to `/history/../secrets/config`.

## Invariant Summary
- `/history/{fundCode}`: `allow get, list: if isVerified(); allow create: if isVerified() && isValidHistory(incoming()); allow update, delete: if false;`
- `/session_state/checklist/items/{itemId}`: `allow read, write: if isVerified() && isValidChecklist(incoming());`

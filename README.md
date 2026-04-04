Call Guide rebuild

Files
- index.html
- styles.css
- js/app.js
- js/schema-io.js
- js/firebase-service.js
- js/defaults.js
- js/firebase-config.js
- AI_SCHEMA_REFERENCE.txt
- AI_SCHEMA_EXAMPLE.txt

What changed
- Home screen to select call type
- Home button at far left of step tabs
- Slim top step tabs
- Slimmer left rail
- No nested scroll boxes
- Single edit/save floating button
- Group and call type management on the home screen in edit mode
- Step and branch management on the call screen in edit mode
- Bulk import/export on the home screen using a structured .txt format designed for AI-assisted editing

Bulk workflow
1. Export .txt from the home screen.
2. Edit the file manually or with an AI agent.
3. Import the file back into the app.
4. Choose MERGE or REPLACE.
5. Review the imported draft.
6. Hit the floating checkmark to save to Firebase.

Files for AI work
- AI_SCHEMA_REFERENCE.txt explains the schema.
- AI_SCHEMA_EXAMPLE.txt is a full exported example.

Import rules
- MERGE updates matching call type ids and adds new ones.
- REPLACE swaps the whole workspace.
- Keep ids stable if you want clean merges.

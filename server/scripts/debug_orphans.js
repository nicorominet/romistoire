
import { query, getConnection } from '../config/database.js';

async function checkOrphans() {
    try {
        console.log("Checking for orphaned story_themes...");
        const sql = `
            SELECT st.id, st.theme_id, st.story_id
            FROM story_themes st 
            LEFT JOIN stories s ON st.story_id = s.id 
            WHERE s.id IS NULL
        `;
        const orphans = await query(sql);
        console.log(`Found ${orphans.length} orphans.`);
        if (orphans.length > 0) {
            console.log("Sample orphans:", orphans.slice(0, 3));
        }

        // Check specifically for the theme mentioned if I had the ID, but I don't.
        // Wait, the logs might have ID if I looked closely, but user didn't give it.
        // Actually user said "http://localhost:8885/edit/9874d5ef-..." that's a story ID.
        // The theme ID is unknown.
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkOrphans();

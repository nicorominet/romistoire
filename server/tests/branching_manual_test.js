
import { storyService } from '../services/story.service.js';
import { query, closeConnections, initializeDatabase } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

async function testBranching() {
    console.log("Starting Branching/Collision Test...");
    try {
        await initializeDatabase();
        
        const weekNum = 999;
        const day = 'Monday';
        const age = '4-6';
        const locale = 'fr';

        // Fetch a valid theme to avoid FK issues
        const themes = await query('SELECT id FROM themes LIMIT 1');
        const themeId = themes.length > 0 ? themes[0].id : uuidv4();
        
        if (themes.length === 0) {
            console.log("No themes found, creating a dummy theme...");
            await query('INSERT INTO themes (id, name, color) VALUES (?, ?, ?)', [themeId, 'Test Theme', '#000000']);
        }

        // 1. Create a story in a slot
        console.log("Creating first story...");
        const s1 = await storyService.create({
            title: "Original Story",
            content: "Content 1",
            themes: [{id: themeId, isPrimary: true}],
            ageGroup: age,
            locale: locale,
            dayOfWeek: day,
            weekNumber: weekNum,
            illustrations: []
        });
        console.log("Story 1 created with ID:", s1.id);

        // 2. Create another story in the SAME slot without series
        console.log("Creating second story in same slot (expecting Branch)...");
        const s2 = await storyService.create({
            title: "Collision Story",
            content: "Content 2",
            themes: [{id: themeId, isPrimary: true}],
            ageGroup: age,
            locale: locale,
            dayOfWeek: day,
            weekNumber: weekNum,
            illustrations: []
        });
        
        // Fetch s2 full data to see series
        const s2Full = await storyService.findById(s2.id);
        console.log("Story 2 created. Series Name:", s2Full.series_name);
        
        if (s2Full.series_name && s2Full.series_name.includes("Alias")) {
            console.log("✅ SUCCESS: Branching triggered correctly!");
        } else {
            console.log("❌ FAILURE: Branching did not trigger or series name incorrect.");
        }

        // Cleanup
        console.log("Cleaning up test data...");
        await query('DELETE FROM stories WHERE week_number = ?', [weekNum]);
        // Note: Series might remain in DB but that's fine for this test scope
        
    } catch (e) {
        console.error("Test failed with error:", e);
    } finally {
        await closeConnections();
    }
}

testBranching();

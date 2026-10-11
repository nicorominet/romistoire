/**
 * Typography fix of the stories already in the library: French quotes « » with non-breaking spaces,
 * CJK brackets removed, non-breaking spaces before ; : ! ?, "..." -> "…" (story_quality.helper normalizeTypography).
 * No word changes: the review status, the "edited" flag and the audio are kept; each story changed gets a version.
 *
 * Usage: node scripts/normalize_typography.js            (dry run: lists what would change)
 *        node scripts/normalize_typography.js --apply    (writes)
 */
import { query, closeConnections } from '../server/config/database.js';
import { storyService } from '../server/services/story.service.js';
import { normalizeHtmlTypography, normalizeTypography } from '../server/services/helpers/story_quality.helper.js';

const apply = process.argv.includes('--apply');
const visible = (text) => text.replace(/ /g, '⍽').replace(/ /g, '·');

const stories = await query('SELECT id, title, content, week_number, age_group, day_order FROM stories ORDER BY week_number, age_group, day_order');
let changed = 0;
for (const story of stories) {
  const title = normalizeTypography(story.title);
  const content = normalizeHtmlTypography(story.content);
  if (title === story.title && content === story.content) continue;
  changed++;
  if (changed <= 5) {
    const before = story.content.replace(/<[^>]+>/g, ' ');
    const after = content.replace(/<[^>]+>/g, ' ');
    const at = [...before].findIndex((char, i) => char !== after[i]);
    console.log(`S${story.week_number} ${story.age_group} j${story.day_order} « ${story.title} »\n  avant : ${visible(before.slice(Math.max(0, at - 30), at + 50))}\n  après : ${visible(after.slice(Math.max(0, at - 30), at + 50))}`);
  }
  if (apply) await storyService.update(story.id, { title, content }, { mechanical: true });
}
console.log(`\n${changed} histoire(s) sur ${stories.length} ${apply ? 'corrigée(s)' : 'à corriger (essai à blanc, --apply pour écrire)'}.`);
await closeConnections();

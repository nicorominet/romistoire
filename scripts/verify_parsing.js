
const testInputs = [
    {
        name: "Ollama Loose JSON",
        text: `**Titre de l'Histoire :** Le Test
**Thème Hebdomadaire :** Nature
**Tranche d'Âge :** 4-6
**Jour de la Semaine :** Lundi
{"name": "Nature", "description": "Bio", "icon": "🌿", "color": "#FFFFFF"} , {"name": "Physique", "description": "Condensation", "icon": "🧊", "color": "#ADD8E6"}}

Il était une fois...
[Illustration: Un test]`
    },
    {
        name: "Ollama Trailing Braces",
        text: `**Titre de l’Histoire :** Le Mystère de la Neige Étoilée

**Thème Hebdomadaire :** La neige tombe

**Tranche d’Âge :** 10-12

**Jour de la Semaine :** Lundi

{"name": "Nature", "description": "Étudier le processus de formation de la neige et ses effets sur l'environnement", "icon": "❄️", "color": "#FFFFFF"} , {"name": "Physique", "description": "Comprendre la condensation et la formation des cristaux de neige", "icon": "🧊", "color": "#ADD8E6"}}

Nicolas était assis sur le rebord de la fenêtre...`
    },
    {
        name: "Ollama Code Block",
        text: `**Titre :** Test 2
**Tranche d'Âge :** 10-12
\`\`\`json
[{"name": "Science"}]
\`\`\`
Contenu ici.
Descrpition de l'illustration : Une image.`
    }
];

function simulateParsing(rawText) {
    let storyContent = rawText;
    
    // Metadata Cleanup
    const metadataRegexes = [
        /(?:\(?\*\*?)?Titre(?: de l'Histoire)?\s*:?\**\)?\s*(.*?)(?:\n|$)/i,
        /(?:\(?\*\*?)?Thème Hebdomadaire\s*:?\**\)?\s*(.*?)(?:\n|$)/i,
        /(?:\(?\*\*?)?Tranche d['’]Âge\s*:?\**\)?\s*(.*?)(?:\n|$)/i,
        /(?:\(?\*\*?)?Jour de la Semaine\s*:?\**\)?\s*(.*?)(?:\n|$)/i,
        /(?:\(?\*\*?)?Thèmes Associés \(JSON\)\s*:?\**\)?\s*(.*?)(?:\n|$)/i
    ];

    metadataRegexes.forEach(regex => {
        storyContent = storyContent.replace(regex, '');
    });

    // JSON stripping (Copying logic from StoryGenerationTab.tsx)
    // Aggressive pass: Strip ANY JSON-like line that starts with {"name" or is part of a JSON array
    storyContent = storyContent.replace(/\{"name":\s*"[^"]*".*?\}.*$/gm, '');
    // Strip lines that are just comma, bracket, etc.
    storyContent = storyContent.replace(/^\s*[\[\],{}]\s*$/gm, '');

    // Remove Markdown Code Blocks
    storyContent = storyContent.replace(/^```[a-z]*\s*$/gm, '').replace(/^```\s*$/gm, '');
    
    // Remove Metadata Headers (more specific removal for these lines)
    storyContent = storyContent.replace(/(?:\*\*?|)?Tranche d’Âge\s*:.*/gi, '')
                 .replace(/(?:\*\*?|)?Jour de la Semaine\s*:.*/gi, '')
                 .replace(/(?:\*\*?|)?Thème Hebdomadaire\s*:.*/gi, '')
                 .replace(/(?:\*\*?|)?Titre de l’Histoire\s*:.*/gi, '');

    // Illustration cleanup
    const descriptionRegex = /(?:^|\n)\s*(?:\*\*?)?(?:Description(?:\s*de\s*l['’]illustration)?|Illustration|L['’]illustration(?:\s*doit\s*représente[r])?)\s*(?:\d+)?\s*:?(?:\*\*?)?\s*(.*?)(?:\n|$)/i;
    const bracketMatch = storyContent.match(/\[\s*(?:Illustration|Description)(?:\s*\d+)?\s*:?\s*([\s\S]*?)\]/i);
    if (bracketMatch) storyContent = storyContent.replace(bracketMatch[0], '');
    const descMatch = storyContent.match(descriptionRegex);
    if (descMatch) storyContent = storyContent.replace(descMatch[0], '');

    return storyContent.trim();
}

testInputs.forEach(input => {
    console.log(`--- Testing: ${input.name} ---`);
    const cleaned = simulateParsing(input.text);
    console.log("Result:");
    console.log(cleaned);
    console.log("------------------------------");
    if (cleaned.includes('{') || cleaned.includes('"name"')) {
        console.error("❌ FAILED: JSON elements still present!");
    } else {
        console.log("✅ PASSED: Clean content.");
    }
});

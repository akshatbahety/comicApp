import { getLanguage, type LanguageId, type ToneId } from "@/lib/presets";
import type { GenerationSettings, Script } from "@/lib/types";
import { drawMockPanel } from "./mock-art";
import { titleFromIdea } from "./prompts";
import type { AIService, ImageRequest, PanelRequest } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Placeholder beats until Claude writes real scripts. Purely visual: the subject
 * is added once by buildPanelPrompt, and story words ("payoff", the idea's own
 * phrasing repeated) get painted into images as text.
 */
const BEATS: Record<number, string[]> = {
  1: ["Dynamic medium shot of the main character in action"],
  3: [
    "Wide establishing shot of the main character in their surroundings",
    "Medium action shot of the main character hard at work",
    "Close-up of the main character grinning in triumph",
  ],
  4: [
    "Wide establishing shot of the main character in their surroundings",
    "Close-up of the main character looking surprised",
    "Medium action shot of the main character searching and chasing",
    "Wide shot of the main character celebrating with raised arms",
  ],
  6: [
    "Wide establishing shot of the main character in their surroundings",
    "Close-up of the main character looking surprised",
    "Over-the-shoulder shot of the main character discovering a clue",
    "Medium action shot of the main character chasing",
    "Dramatic low-angle shot of the main character at the big moment",
    "Calm wide shot of the main character relaxing afterwards",
  ],
};

/** Placeholder captions per language (F-018). Only captions are translated; scenes stay English. */
const LINES: Record<LanguageId, Record<ToneId, string[]>> = {
  en: {
    funny: ["Well, this is awkward.", "Nobody panic. I'm panicking.", "That was NOT in the plan.", "Totally meant to do that.", "Ta-da!", "Same time tomorrow?"],
    dramatic: ["It all started here.", "Something isn't right.", "There's no turning back now.", "Everything rests on this.", "Now.", "And so it ended — for now."],
    action: ["Let's move!", "Incoming!", "Hold on tight!", "Not today!", "BOOM.", "Mission complete."],
    wholesome: ["What a lovely day.", "Oh! Are you okay?", "We can fix this together.", "Look what we made!", "Thank you, friend.", "Best day ever."],
    spooky: ["Did you hear that?", "The lights flickered.", "Don't look behind you.", "It's getting closer…", "RUN.", "…or was it just the wind?"],
  },
  es: {
    funny: ["Bueno, esto es incómodo.", "Que nadie entre en pánico. Yo sí.", "Eso NO estaba en el plan.", "Lo hice a propósito, claro.", "¡Tachán!", "¿Mañana a la misma hora?"],
    dramatic: ["Todo empezó aquí.", "Algo no anda bien.", "Ya no hay vuelta atrás.", "Todo depende de esto.", "Ahora.", "Y así terminó… por ahora."],
    action: ["¡Vamos!", "¡Cuidado, ahí viene!", "¡Agárrate fuerte!", "¡Hoy no!", "¡BUM!", "Misión cumplida."],
    wholesome: ["Qué día tan bonito.", "¡Oh! ¿Estás bien?", "Podemos arreglarlo juntos.", "¡Mira lo que hicimos!", "Gracias, amigo.", "¡El mejor día de todos!"],
    spooky: ["¿Oíste eso?", "Las luces parpadearon.", "No mires atrás.", "Se está acercando…", "¡CORRE!", "…¿o solo fue el viento?"],
  },
  // French punctuation takes a no-break space before ! and ?, so it never wraps alone.
  fr: {
    funny: ["Bon, c'est gênant.", "Pas de panique. Moi, je panique.", "Ça, ce n'était PAS prévu.", "Je l'ai fait exprès, bien sûr.", "Et voilà !", "Même heure demain ?"],
    dramatic: ["Tout a commencé ici.", "Quelque chose cloche.", "Plus moyen de faire marche arrière.", "Tout repose là-dessus.", "Maintenant.", "Et ainsi tout finit… pour l'instant."],
    action: ["On y va !", "Attention, ça arrive !", "Accroche-toi !", "Pas aujourd'hui !", "BOUM.", "Mission accomplie."],
    wholesome: ["Quelle belle journée.", "Oh ! Ça va ?", "On peut réparer ça ensemble.", "Regarde ce qu'on a fait !", "Merci, mon ami.", "Le plus beau jour de ma vie."],
    spooky: ["Tu as entendu ça ?", "Les lumières ont vacillé.", "Ne regarde pas derrière toi.", "Ça se rapproche…", "COURS.", "…ou était-ce juste le vent ?"],
  },
  hi: {
    funny: ["अरे, यह तो अजीब हो गया।", "कोई घबराए नहीं। मैं घबरा रहा हूँ।", "यह योजना में बिल्कुल नहीं था!", "मैंने यह जानबूझकर किया था।", "टा-डा!", "कल फिर इसी समय?"],
    dramatic: ["सब कुछ यहीं से शुरू हुआ।", "कुछ तो गड़बड़ है।", "अब पीछे मुड़ना नामुमकिन है।", "सब कुछ इसी पर टिका है।", "अभी।", "और यूँ यह खत्म हुआ — फ़िलहाल।"],
    action: ["चलो, चलो!", "सावधान, आ रहा है!", "कसकर पकड़ो!", "आज नहीं!", "धड़ाम!", "मिशन पूरा हुआ।"],
    wholesome: ["कितना सुंदर दिन है।", "अरे! तुम ठीक हो?", "हम मिलकर इसे ठीक कर सकते हैं।", "देखो, हमने क्या बनाया!", "शुक्रिया, दोस्त।", "आज का दिन सबसे अच्छा था।"],
    spooky: ["तुमने वह सुना?", "बत्तियाँ टिमटिमाईं।", "पीछे मत देखना।", "वह करीब आ रहा है…", "भागो!", "…या वह बस हवा थी?"],
  },
  ja: {
    funny: ["えっと、気まずいな。", "落ち着いて。僕はパニックだけど。", "こんなの計画になかった！", "わざとやったんだよ。", "じゃーん！", "また明日、同じ時間に？"],
    dramatic: ["すべてはここから始まった。", "何かがおかしい。", "もう後戻りはできない。", "すべてはこれにかかっている。", "今だ。", "こうして終わった——今のところは。"],
    action: ["行くぞ！", "来るぞ！", "しっかりつかまって！", "今日はそうはいかない！", "ドカーン！", "任務完了。"],
    wholesome: ["なんて素敵な日。", "あっ！大丈夫？", "一緒に直そうよ。", "見て、みんなで作ったよ！", "ありがとう、友よ。", "最高の一日！"],
    spooky: ["今の聞こえた？", "明かりがちらついた。", "後ろを見ちゃだめ。", "近づいてくる…", "逃げて！", "…それとも、ただの風？"],
  },
};

/** Phase 1 stand-in for Claude + fal.ai: canned scripts and drawn placeholder scenes. */
export class MockAIService implements AIService {
  modelFor() {
    return "demo-mock";
  }

  async writeScript(idea: string, settings: GenerationSettings): Promise<Script> {
    await sleep(900 + Math.random() * 600);
    const beats = BEATS[settings.panelCount] ?? BEATS[4];
    const lines = LINES[getLanguage(settings.language).id][settings.tone];
    return {
      title: titleFromIdea(idea),
      characters: `the main character of: ${idea.trim()}`,
      panels: beats.map((beat, i) => ({
        scene: beat.replace("{idea}", idea.trim().replace(/\.$/, "")),
        caption: settings.panelCount === 1 ? lines[0] : lines[Math.round((i * (lines.length - 1)) / (beats.length - 1))],
      })),
    };
  }

  async generateCharacter(req: ImageRequest) {
    await sleep(900 + Math.random() * 600);
    return { ...drawMockPanel({ ...req.settings, aspectRatio: "1:1" }, 0, req.seed), model: "demo-mock" };
  }

  async generatePanel(req: PanelRequest) {
    await sleep(1200 + Math.random() * 1600);
    return { ...drawMockPanel(req.settings, req.panelIndex, req.seed), model: "demo-mock" };
  }
}

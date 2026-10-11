import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Plus, Save, Trash2, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { i18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AGE_GROUPS } from "@/types/Story";
import { seriesCastApi } from "@/api/seriesCast.api";
import { currentIsoWeek } from "@/utils/weekUtils";
import { ageAtWeek, nextBirthdayWeek } from "@/utils/castAge";
import { useSeriesCastMutations } from "@/hooks/useSeriesCasts";
import {
  Cast, CastCharacter, CastInput, CastIssue, CastValidation, PHYSICAL_FIELDS, RELATION_TYPES, RelationType,
} from "@/types/framed.types";

export const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** Genders given to the prompt, in French ("féminin", "masculin"). */
const GENDERS = ["féminin", "masculin"] as const;

/** Wait after the last change before checking the cast on the server. */
const VALIDATE_DELAY_MS = 600;

const emptyCharacter = (): CastCharacter => ({
  key: "", name: "", role: "main", species: "", gender: "", age: null, birthday: null,
  physical: { hair: "", eyes: "", build: "", clothing: "", distinctive: "" },
  personality: "", speech: "", visual: "", relations: [],
});

const toInput = (cast: Cast | null, legacySheet: string, takenAges: string[]): CastInput => cast
  ? { name: cast.name, ageGroups: cast.ageGroups, universe: cast.universe, rules: cast.rules, characters: cast.characters, referenceWeek: cast.referenceWeek }
  : {
    name: "", ageGroups: AGE_GROUPS.filter((age) => !takenAges.includes(age)).slice(0, 1), universe: legacySheet, rules: [],
    // Ages are typed as they are now
    characters: [emptyCharacter()], referenceWeek: currentIsoWeek().week,
  };

/** Key a tie points to: the key once saved, the name before. */
const refOf = (character: CastCharacter) => character.key || character.name;

/** Message of a validation issue. */
const issueText = (issue: CastIssue) => i18n.t(`framed.issues.${issue.code}`, { detail: issue.detail ?? "" });

interface CastEditorProps {
  seriesId: string;
  cast: Cast | null;
  /** Old automatic sheet of the series: the universe of a first cast starts from it */
  legacySheet: string;
  /** Age groups of the other casts of the series */
  takenAges: string[];
  onSaved: (cast: Cast) => void;
  onDeleted: () => void;
}

/**
 * CastEditor Component
 *
 * Bible of a framed series: the cast (characters, ages, birthdays, look, ties), its age groups, its world and
 * rules. Checked on the server while typing (family ages, ties both ways, heroes of the right age); errors
 * forbid saving, warnings are shown.
 */
export const CastEditor = ({ seriesId, cast, legacySheet, takenAges, onSaved, onDeleted }: CastEditorProps) => {
  const { t } = i18n;
  const [draft, setDraft] = useState<CastInput>(() => toInput(cast, legacySheet, takenAges));
  const [validation, setValidation] = useState<CastValidation | null>(null);
  const [checking, setChecking] = useState(false);
  const { save, remove } = useSeriesCastMutations(seriesId);
  const thisWeek = currentIsoWeek().week;

  useEffect(() => {
    setDraft(toInput(cast, legacySheet, takenAges));
    // A new cast or another cast: start again (takenAges only matters for a new one)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cast?.id, cast?.version, legacySheet]);

  // Server check, a moment after the last change
  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(() => {
      seriesCastApi.validate(seriesId, draft, cast?.id ?? null)
        .then((result) => { if (!cancelled) setValidation(result); })
        .catch(() => { if (!cancelled) setValidation(null); })
        .finally(() => { if (!cancelled) setChecking(false); });
    }, VALIDATE_DELAY_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [seriesId, cast?.id, draft]);

  const update = (changes: Partial<CastInput>) => setDraft((current) => ({ ...current, ...changes }));
  const updateCharacter = (index: number, changes: Partial<CastCharacter>) =>
    update({ characters: draft.characters.map((c, i) => (i === index ? { ...c, ...changes } : c)) });
  const removeCharacter = (index: number) => {
    const removed = refOf(draft.characters[index]);
    update({
      characters: draft.characters
        .filter((_, i) => i !== index)
        .map((c) => ({ ...c, relations: c.relations.filter((r) => r.to !== removed) })),
    });
  };

  const errors = validation?.errors ?? [];
  const warnings = validation?.warnings ?? [];
  const allIssues = useMemo(
    () => [...errors.map((issue) => ({ ...issue, level: "error" })), ...warnings.map((issue) => ({ ...issue, level: "warning" }))],
    [errors, warnings],
  );
  // The server keeps the order of the characters: its keys match the draft by position
  const serverKeys = validation?.cast.characters.map((c) => c.key) ?? [];
  const issuesOf = (index: number) => allIssues.filter((issue) => issue.character && issue.character === serverKeys[index]);
  const generalIssues = allIssues.filter((issue) => !issue.character);

  const handleSave = () => save.mutate({ castId: cast?.id ?? null, cast: draft }, {
    onSuccess: (result) => {
      toast.success(t("framed.bible.saved"));
      onSaved(result.cast);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const handleDelete = () => {
    if (!cast || !window.confirm(t("framed.bible.deleteConfirm", { name: cast.name }))) return;
    remove.mutate(cast.id, { onSuccess: onDeleted, onError: (error) => toast.error((error as Error).message) });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cast-name">{t("framed.bible.name")}</Label>
          <Input id="cast-name" value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder={t("framed.bible.namePlaceholder")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cast-reference">{t("framed.bible.referenceWeek")}</Label>
          <Input id="cast-reference" type="number" min="1" max="53" value={draft.referenceWeek}
            onChange={(e) => update({ referenceWeek: Number(e.target.value) || 1 })} />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("framed.bible.referenceWeekHint", { week: String(thisWeek) })}
            {draft.referenceWeek !== thisWeek && (
              <Button type="button" variant="link" size="sm" className="h-auto p-0 pl-1" onClick={() => update({ referenceWeek: thisWeek })}>
                {t("framed.bible.useThisWeek", { week: String(thisWeek) })}
              </Button>
            )}
          </p>
        </div>

        <fieldset className="space-y-2 md:col-span-2">
          <legend className="text-sm font-medium">{t("framed.bible.ageGroups")}</legend>
          <div className="flex flex-wrap gap-4">
            {AGE_GROUPS.map((age) => {
              const taken = takenAges.includes(age);
              return (
                <label key={age} className={`flex items-center gap-2 text-sm ${taken ? "opacity-50" : ""}`} title={taken ? t("framed.bible.ageTaken") : undefined}>
                  <Checkbox
                    checked={draft.ageGroups.includes(age)}
                    disabled={taken}
                    onCheckedChange={(checked) => update({
                      ageGroups: checked === true ? [...draft.ageGroups, age] : draft.ageGroups.filter((a) => a !== age),
                    })}
                  />
                  {t(`ages.${age}`)}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("framed.bible.ageGroupsHint")}</p>
        </fieldset>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="cast-universe">{t("framed.bible.universe")}</Label>
          <Textarea id="cast-universe" rows={3} value={draft.universe} onChange={(e) => update({ universe: e.target.value })}
            placeholder={t("framed.bible.universePlaceholder")} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="cast-rules">{t("framed.bible.rules")}</Label>
          <Textarea id="cast-rules" rows={3} value={draft.rules.join("\n")}
            onChange={(e) => update({ rules: e.target.value.split("\n") })}
            onBlur={() => update({ rules: draft.rules.map((r) => r.trim()).filter(Boolean) })}
            placeholder={t("framed.bible.rulesPlaceholder")} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{t("framed.bible.characters")}</h3>
          <Button type="button" size="sm" variant="outline" className="gap-1"
            onClick={() => update({ characters: [...draft.characters, { ...emptyCharacter(), role: "recurring" }] })}>
            <UserPlus className="h-4 w-4" /> {t("framed.bible.addCharacter")}
          </Button>
        </div>

        {draft.characters.map((character, index) => {
          const others = draft.characters.filter((_, i) => i !== index && draft.characters[i].name.trim());
          const issues = issuesOf(index);
          return (
            <div key={index} className="space-y-3 rounded-lg border bg-white/50 p-4 dark:bg-slate-800/50">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor={`char-name-${index}`}>{t("framed.character.name")}</Label>
                  <Input id={`char-name-${index}`} value={character.name} onChange={(e) => updateCharacter(index, { name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`char-role-${index}`}>{t("framed.character.role")}</Label>
                  <select id={`char-role-${index}`} className={selectClass} value={character.role}
                    onChange={(e) => updateCharacter(index, { role: e.target.value as CastCharacter["role"] })}>
                    <option value="main">{t("framed.character.roles.main")}</option>
                    <option value="recurring">{t("framed.character.roles.recurring")}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`char-age-${index}`}>{t("framed.character.age")}</Label>
                  <Input id={`char-age-${index}`} type="number" min="0" max="120" value={character.age ?? ""}
                    onChange={(e) => updateCharacter(index, { age: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`char-birthday-${index}`}>{t("framed.character.birthday")}</Label>
                  <Input id={`char-birthday-${index}`} placeholder="MM-JJ" value={character.birthday ?? ""}
                    onChange={(e) => updateCharacter(index, { birthday: e.target.value.trim() || null })} />
                </div>
                <div className="flex items-end justify-end">
                  <Button type="button" size="icon" variant="ghost" className="text-red-600" disabled={draft.characters.length === 1}
                    onClick={() => removeCharacter(index)} aria-label={t("framed.bible.removeCharacter")} title={t("framed.bible.removeCharacter")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="col-span-1 space-y-1 md:col-span-3">
                  <Label htmlFor={`char-species-${index}`}>{t("framed.character.species")}</Label>
                  <Input id={`char-species-${index}`} value={character.species} placeholder={t("framed.character.speciesPlaceholder")}
                    onChange={(e) => updateCharacter(index, { species: e.target.value })} />
                </div>
                <div className="col-span-1 space-y-1 md:col-span-3">
                  <Label htmlFor={`char-gender-${index}`}>{t("framed.character.gender")}</Label>
                  {/* Values are the words given to the prompt; an older free value stays selectable */}
                  <select id={`char-gender-${index}`} className={selectClass} value={character.gender}
                    onChange={(e) => updateCharacter(index, { gender: e.target.value })}>
                    <option value="">{t("framed.character.genders.none")}</option>
                    {GENDERS.map((gender) => <option key={gender} value={gender}>{t(`framed.character.genders.${gender}`)}</option>)}
                    {character.gender && !(GENDERS as readonly string[]).includes(character.gender) && (
                      <option value={character.gender}>{character.gender}</option>
                    )}
                  </select>
                </div>
              </div>

              {character.age !== null && (() => {
                // Ages as the stories will tell them: a wrong reference week shows at once
                const now = ageAtWeek(character.age, character.birthday, thisWeek, draft.referenceWeek);
                const birthdayWeek = character.birthday && /^\d{2}-\d{2}$/.test(character.birthday) ? nextBirthdayWeek(character.birthday) : null;
                return (
                  <p className={`text-xs ${now !== character.age ? "text-amber-700 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"}`}>
                    {t("framed.character.ageNow", { week: String(thisWeek), age: String(now) })}
                    {birthdayWeek && ` · ${t("framed.character.ageAfterBirthday", {
                      week: String(birthdayWeek),
                      age: String(ageAtWeek(character.age, character.birthday, birthdayWeek, draft.referenceWeek, new Date(), 3)),
                    })}`}
                  </p>
                );
              })()}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                {PHYSICAL_FIELDS.map((field) => (
                  <div key={field} className="space-y-1">
                    <Label htmlFor={`char-${field}-${index}`}>{t(`framed.character.physical.${field}`)}</Label>
                    <Input id={`char-${field}-${index}`} value={character.physical[field]}
                      onChange={(e) => updateCharacter(index, { physical: { ...character.physical, [field]: e.target.value } })} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`char-personality-${index}`}>{t("framed.character.personality")}</Label>
                  <Textarea id={`char-personality-${index}`} rows={2} value={character.personality}
                    onChange={(e) => updateCharacter(index, { personality: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`char-speech-${index}`}>{t("framed.character.speech")}</Label>
                  <Textarea id={`char-speech-${index}`} rows={2} value={character.speech}
                    onChange={(e) => updateCharacter(index, { speech: e.target.value })} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor={`char-visual-${index}`}>{t("framed.character.visual")}</Label>
                  <Textarea id={`char-visual-${index}`} rows={2} value={character.visual} placeholder={t("framed.character.visualPlaceholder")}
                    onChange={(e) => updateCharacter(index, { visual: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">{t("framed.character.relations")}</span>
                {character.relations.map((relation, r) => (
                  <div key={r} className="flex items-center gap-2">
                    <select className={selectClass} value={relation.type} aria-label={t("framed.character.relationType")}
                      onChange={(e) => updateCharacter(index, {
                        relations: character.relations.map((x, i) => (i === r ? { ...x, type: e.target.value as RelationType } : x)),
                      })}>
                      {RELATION_TYPES.map((type) => <option key={type} value={type}>{t(`framed.relations.${type}`)}</option>)}
                    </select>
                    <select className={selectClass} value={relation.to} aria-label={t("framed.character.relationTo")}
                      onChange={(e) => updateCharacter(index, {
                        relations: character.relations.map((x, i) => (i === r ? { ...x, to: e.target.value } : x)),
                      })}>
                      <option value="">—</option>
                      {others.map((other) => <option key={refOf(other)} value={refOf(other)}>{other.name}</option>)}
                    </select>
                    <Button type="button" size="icon" variant="ghost" aria-label={t("framed.bible.removeRelation")}
                      onClick={() => updateCharacter(index, { relations: character.relations.filter((_, i) => i !== r) })}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {others.length > 0 && (
                  <Button type="button" size="sm" variant="ghost" className="gap-1"
                    onClick={() => updateCharacter(index, { relations: [...character.relations, { to: refOf(others[0]), type: "friend" }] })}>
                    <Plus className="h-4 w-4" /> {t("framed.bible.addRelation")}
                  </Button>
                )}
              </div>

              {issues.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {issues.map((issue, i) => (
                    <li key={i} className={issue.level === "error" ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}>
                      {issueText(issue)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {(generalIssues.length > 0 || checking) && (
        <div className="space-y-1 rounded-lg border p-3 text-sm" aria-live="polite">
          {checking && <p className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> {t("framed.bible.checking")}</p>}
          {generalIssues.map((issue, i) => (
            <p key={i} className={`flex items-center gap-2 ${issue.level === "error" ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
              <AlertTriangle className="h-4 w-4" /> {issueText(issue)}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleSave} disabled={save.isPending || checking || errors.length > 0} className="gap-1">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {cast ? t("framed.bible.saveVersion", { version: String(cast.version + 1) }) : t("framed.bible.create")}
        </Button>
        {cast && (
          <Button type="button" variant="outline" className="gap-1 text-red-600" onClick={handleDelete} disabled={remove.isPending}>
            <Trash2 className="h-4 w-4" /> {t("framed.bible.delete")}
          </Button>
        )}
      </div>
      {errors.length > 0 && <p className="text-sm text-red-600 dark:text-red-400">{t("framed.bible.fixErrors", { count: String(errors.length) })}</p>}
    </div>
  );
};

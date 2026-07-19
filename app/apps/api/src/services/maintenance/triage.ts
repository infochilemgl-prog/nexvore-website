export type MaintenanceUrgency = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type MaintenanceCategory =
  | "PLUMBING"
  | "ELECTRICAL"
  | "HVAC"
  | "WIFI"
  | "APPLIANCE"
  | "LOCK"
  | "CLEANING"
  | "SAFETY"
  | "AESTHETIC"
  | "OTHER";

export interface TriageResult {
  urgency: MaintenanceUrgency;
  category: MaintenanceCategory;
  matchedRule: string;
  isLifeSafety: boolean;
}

/**
 * Deterministic maintenance urgency triage. These rules ALWAYS win over
 * whatever the model might classify -- the model may propose a category, but
 * this function has final say on urgency, and is checked before/alongside
 * any AI-based classification in the classify_maintenance_issue tool.
 */
const CRITICAL_PATTERNS: Array<[RegExp, MaintenanceCategory, string]> = [
  [/\bgas\b/i, "SAFETY", "olor a gas"],
  [/incendio|fuego|humo\b|fire\b/i, "SAFETY", "incendio/humo"],
  [/chispas?|spark/i, "ELECTRICAL", "chispas electricas"],
  [/intrus|robo|alguien.*(entr|forz)|break-?in/i, "SAFETY", "intrusion"],
  [/inundaci[oó]n (mayor|grande|severa)|flooding/i, "PLUMBING", "inundacion mayor activa"],
  [/puerta.*(no cierra|no asegura|no traba)|door.*(won'?t (lock|secure))/i, "LOCK", "puerta no asegura la propiedad"],
  [/atrapad[oa]|trapped/i, "SAFETY", "persona atrapada"],
  [/riesgo (fisico|de vida)|emergencia medica|medical emergency/i, "SAFETY", "riesgo fisico/emergencia medica"],
];

const HIGH_PATTERNS: Array<[RegExp, MaintenanceCategory, string]> = [
  [/sin luz en toda|corte total de luz|no hay electricidad en toda|total power outage/i, "ELECTRICAL", "corte total de energia"],
  [/no hay agua\b|sin agua\b|no water/i, "PLUMBING", "sin agua"],
  [/cerradura.*(no (abre|funciona))|unusable lock/i, "LOCK", "cerradura inutilizable"],
  [/(aire acondicionado|calefaccion|a\/?c|heating).*(no (funciona|enciende))/i, "HVAC", "climatizacion fuera de servicio"],
  [/fuga (grande|importante)|major leak/i, "PLUMBING", "fuga importante"],
  [/[uú]nico ba[ñn]o.*(no funciona|inutilizable)|only bathroom.*unusable/i, "PLUMBING", "unico bano inutilizable"],
];

const MEDIUM_PATTERNS: Array<[RegExp, MaintenanceCategory, string]> = [
  [/wifi|internet/i, "WIFI", "wifi/internet"],
  [/lavadora|refrigerador|microondas|horno|lavavajillas|appliance/i, "APPLIANCE", "electrodomestico"],
  [/agua caliente|hot water/i, "PLUMBING", "agua caliente (no peligroso)"],
  [/televisor|tv\b/i, "APPLIANCE", "television"],
  [/ruido (raro|extra[nñ]o)|technical noise/i, "OTHER", "ruido tecnico"],
];

const LOW_PATTERNS: Array<[RegExp, MaintenanceCategory, string]> = [
  [/cosmetic|est[eé]tico|pintura|mancha/i, "AESTHETIC", "cosmetico"],
  [/ampolleta|foco secundario|bulb/i, "ELECTRICAL", "ampolleta secundaria"],
  [/no esencial|non-essential/i, "OTHER", "articulo no esencial"],
];

export function triageMaintenanceIssue(description: string): TriageResult {
  const text = description ?? "";

  for (const [re, category, rule] of CRITICAL_PATTERNS) {
    if (re.test(text)) return { urgency: "CRITICAL", category, matchedRule: rule, isLifeSafety: true };
  }
  for (const [re, category, rule] of HIGH_PATTERNS) {
    if (re.test(text)) return { urgency: "HIGH", category, matchedRule: rule, isLifeSafety: false };
  }
  for (const [re, category, rule] of MEDIUM_PATTERNS) {
    if (re.test(text)) return { urgency: "MEDIUM", category, matchedRule: rule, isLifeSafety: false };
  }
  for (const [re, category, rule] of LOW_PATTERNS) {
    if (re.test(text)) return { urgency: "LOW", category, matchedRule: rule, isLifeSafety: false };
  }

  return { urgency: "MEDIUM", category: "OTHER", matchedRule: "sin coincidencia, urgencia media por defecto", isLifeSafety: false };
}

const DANGEROUS_TOPICS = /(tablero el[eé]ctrico|panel el[eé]ctrico|electrical panel|gas (pipe|valve|v[aá]lvula)|equipo (contra incendio|de incendio)|fire.?safety equipment|extintor)/i;

/** Guardrail used by prompt-builders and tool handlers: never let guest-facing text instruct touching these. */
export function containsDangerousInstruction(text: string): boolean {
  return DANGEROUS_TOPICS.test(text);
}

export function getSafeTroubleshootingGuide(category: MaintenanceCategory): string {
  const guides: Record<MaintenanceCategory, string> = {
    WIFI: "Intenta reiniciar el router (desconectalo 10 segundos y vuelve a conectarlo) y verifica que el modem tenga luces encendidas.",
    APPLIANCE: "Revisa que el equipo este conectado y el enchufe tenga corriente. Evita forzar botones si hace ruidos extranos.",
    PLUMBING: "Si es una fuga menor, cierra la llave de paso mas cercana si es segura y accesible, y coloca una toalla para contener el agua.",
    HVAC: "Verifica el control remoto/termostato y que los filtros no esten obstruidos visualmente.",
    ELECTRICAL: "Por seguridad, no manipules tableros ni cableado. Evita usar el enchufe o artefacto afectado hasta que lo revisemos.",
    LOCK: "Si la puerta aun cierra con llave desde adentro, uso normal por ahora; evita forzar la cerradura.",
    CLEANING: "Contacta a housekeeping para reprogramar o reforzar la limpieza.",
    SAFETY: "Por tu seguridad, no intentes resolverlo tu mismo: contacta a emergencias si aplica y a nuestro equipo humano.",
    AESTHETIC: "Gracias por avisar, no requiere accion inmediata; lo dejamos agendado para la proxima mantencion.",
    OTHER: "Nuestro equipo revisara el detalle a la brevedad.",
  };
  return guides[category];
}

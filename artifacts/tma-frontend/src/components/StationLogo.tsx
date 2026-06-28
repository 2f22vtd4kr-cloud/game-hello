/** SVG monogram logo for a gas station network, rendered as a colored circle badge */

const NETWORK_COLORS: Record<string, { bg: string; text: string }> = {
  "Лукойл":           { bg: "#dc2626", text: "#fff"    },
  "Роснефть":         { bg: "#1d4ed8", text: "#fff"    },
  "ГазпромНефть":     { bg: "#4338ca", text: "#fff"    },
  "Газпромнефть":     { bg: "#4338ca", text: "#fff"    },
  "Газпром":          { bg: "#1e40af", text: "#fff"    },
  "Татнефть":         { bg: "#92400e", text: "#fff"    },
  "Сургутнефтегаз":   { bg: "#6d28d9", text: "#fff"    },
  "ОПТИ":             { bg: "#0f766e", text: "#fff"    },
  "Тебойл":           { bg: "#0369a1", text: "#fff"    },
  "Teboil":           { bg: "#0369a1", text: "#fff"    },
  "Башнефть":         { bg: "#065f46", text: "#fff"    },
  "ТАИФ-НК":          { bg: "#7c2d12", text: "#fff"    },
  "КНП":              { bg: "#5b21b6", text: "#fff"    },
  "Восток-Ресурс":    { bg: "#9a3412", text: "#fff"    },
  "Калина Ойл":       { bg: "#166534", text: "#fff"    },
  "Ирбис":            { bg: "#1e3a5f", text: "#fff"    },
  "Топлайн":          { bg: "#4c1d95", text: "#fff"    },
  "РТК":              { bg: "#831843", text: "#fff"    },
  "АЗС Юг":          { bg: "#713f12", text: "#fff"    },
  "ПТК":              { bg: "#0c4a6e", text: "#fff"    },
  "Нефтьмагистраль":  { bg: "#14532d", text: "#fff"    },
  "АТАН":             { bg: "#E8622A", text: "#fff"    },
  "ТЭС":              { bg: "#E8622A", text: "#fff"    },
  "Грифон":           { bg: "#ea580c", text: "#fff"    },
  "Таврия-Ойл":       { bg: "#0891b2", text: "#fff"    },
  "РНК":              { bg: "#4338ca", text: "#fff"    },
  "Нефтис":           { bg: "#6d28d9", text: "#fff"    },
  "Shell":            { bg: "#d97706", text: "#fff"    },
  "BP":               { bg: "#16a34a", text: "#fff"    },
  "ТНКБП":            { bg: "#0369a1", text: "#fff"    },
  "ТНК":              { bg: "#0369a1", text: "#fff"    },
  "Независимая":      { bg: "#374151", text: "#d1d5db" },
};

function getNetworkStyle(network: string): { bg: string; text: string } {
  for (const [key, style] of Object.entries(NETWORK_COLORS)) {
    if (network.toLowerCase().includes(key.toLowerCase())) return style;
  }
  // Fallback: hash the first chars to pick a color
  const code = network.charCodeAt(0) + (network.charCodeAt(1) || 0);
  const PALETTES = [
    { bg: "#7c3aed", text: "#fff" },
    { bg: "#0f766e", text: "#fff" },
    { bg: "#b45309", text: "#fff" },
    { bg: "#0369a1", text: "#fff" },
    { bg: "#047857", text: "#fff" },
    { bg: "#be185d", text: "#fff" },
    { bg: "#c2410c", text: "#fff" },
  ];
  return PALETTES[code % PALETTES.length];
}

function getInitials(network: string): string {
  const words = network.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return network.slice(0, 2).toUpperCase();
}

interface Props {
  network: string;
  size?: number;
}

export function StationLogo({ network, size = 32 }: Props) {
  if (!network) return null;
  const style = getNetworkStyle(network);
  const initials = getInitials(network);
  const fontSize = size * 0.38;

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: style.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, fontWeight: 800, color: style.text,
      fontFamily: "'Inter', system-ui, sans-serif",
      flexShrink: 0,
      boxShadow: `0 0 8px ${style.bg}55, inset 0 1px 0 rgba(255,255,255,0.2)`,
      letterSpacing: "-0.03em",
      userSelect: "none",
    }}>
      {initials}
    </div>
  );
}

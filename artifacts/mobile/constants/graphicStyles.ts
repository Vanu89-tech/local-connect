export type GraphicStyleId = "comicPop" | "cleanLight" | "nightArcade" | "neon";

export type GraphicStyle = {
  id: GraphicStyleId;
  name: string;
  description: string;
  colors: {
    ink: string;
    textSecondary: string;
    textTertiary: string;
    paper: string;
    surface: string;
    surfaceAlt: string;
    primary: string;
    accent: string;
    accentBlue: string;
    yellow: string;
    mint: string;
    danger: string;
    placeholder: string;
    separator: string;
    card: string;
    tabIconDefault: string;
    onBright: string;
    onPrimary: string;
  };
  shape: {
    radiusSm: number;
    radiusMd: number;
    radiusLg: number;
    borderWidthThin: number;
    borderWidth: number;
  };
  shadow: {
    color: string;
    opacity: number;
    radius: number;
    offsetY: number;
  };
  typography: {
    displayShadowColor: string;
    displayShadowOffset: { width: number; height: number };
    displayShadowRadius: number;
  };
  map: {
    paper: string;
    overlayBlue: string;
    overlayPink: string;
    overlayYellow: string;
    accentBlue: string;
    accentPink: string;
    accentYellow: string;
    buildingLow: string;
    buildingMid: string;
    buildingHigh: string;
    buildingTall: string;
    partyFill: string;
    partyShadow: string;
  };
};

export const GRAPHIC_STYLES: Record<GraphicStyleId, GraphicStyle> = {
  comicPop: {
    id: "comicPop",
    name: "Comic Pop",
    description: "Bunte, spielerische Locals-Optik mit dicker Kontur und klaren Flächen.",
    colors: {
      ink: "#152238",
      textSecondary: "#42526D",
      textTertiary: "#7890A8",
      paper: "#F2FBFF",
      surface: "#FFFFFF",
      surfaceAlt: "#DFF4FF",
      primary: "#152238",
      accent: "#FF4D8F",
      accentBlue: "#21C7D9",
      yellow: "#FFD84D",
      mint: "#22C55E",
      danger: "#EF4444",
      placeholder: "#B8C7D8",
      separator: "#152238",
      card: "#FFFFFF",
      tabIconDefault: "#7890A8",
      onBright: "#152238",
      onPrimary: "#FFFFFF",
    },
    shape: {
      radiusSm: 8,
      radiusMd: 8,
      radiusLg: 8,
      borderWidthThin: 2,
      borderWidth: 3,
    },
    shadow: {
      color: "#152238",
      opacity: 0.22,
      radius: 0,
      offsetY: 3,
    },
    typography: {
      displayShadowColor: "#FFD84D",
      displayShadowOffset: { width: 5, height: 4 },
      displayShadowRadius: 0,
    },
    map: {
      paper: "#EAF4FF",
      overlayBlue: "rgba(93, 214, 255, 0.22)",
      overlayPink: "rgba(255, 122, 182, 0.2)",
      overlayYellow: "rgba(255, 216, 77, 0.16)",
      accentBlue: "#5DD6FF",
      accentPink: "#FF7AB6",
      accentYellow: "#FFD84D",
      buildingLow: "#E0FBFF",
      buildingMid: "#C7F3FF",
      buildingHigh: "#FFE0F0",
      buildingTall: "#FFF0B3",
      partyFill: "#8B5CF6",
      partyShadow: "rgba(139,92,246,0.55)",
    },
  },
  cleanLight: {
    id: "cleanLight",
    name: "Clean Light",
    description: "Ruhiger heller Stil als spätere Alternative für Tests mit weniger Comic-Energie.",
    colors: {
      ink: "#111827",
      textSecondary: "#4B5563",
      textTertiary: "#8A94A6",
      paper: "#F8FAFC",
      surface: "#FFFFFF",
      surfaceAlt: "#EEF4FF",
      primary: "#111827",
      accent: "#2563EB",
      accentBlue: "#0891B2",
      yellow: "#FACC15",
      mint: "#16A34A",
      danger: "#DC2626",
      placeholder: "#CBD5E1",
      separator: "#D8E0EA",
      card: "#FFFFFF",
      tabIconDefault: "#94A3B8",
      onBright: "#111827",
      onPrimary: "#FFFFFF",
    },
    shape: {
      radiusSm: 8,
      radiusMd: 8,
      radiusLg: 8,
      borderWidthThin: 1,
      borderWidth: 1,
    },
    shadow: {
      color: "#0F172A",
      opacity: 0.08,
      radius: 10,
      offsetY: 4,
    },
    typography: {
      displayShadowColor: "transparent",
      displayShadowOffset: { width: 0, height: 0 },
      displayShadowRadius: 0,
    },
    map: {
      paper: "#F8FAFC",
      overlayBlue: "rgba(37, 99, 235, 0.08)",
      overlayPink: "rgba(8, 145, 178, 0.06)",
      overlayYellow: "rgba(250, 204, 21, 0.08)",
      accentBlue: "#38BDF8",
      accentPink: "#60A5FA",
      accentYellow: "#FACC15",
      buildingLow: "#E2E8F0",
      buildingMid: "#CBD5E1",
      buildingHigh: "#BAE6FD",
      buildingTall: "#BFDBFE",
      partyFill: "#2563EB",
      partyShadow: "rgba(37,99,235,0.32)",
    },
  },
  nightArcade: {
    id: "nightArcade",
    name: "Night Arcade",
    description: "Dunkler Teststil für eine spätere Neon-Variante.",
    colors: {
      ink: "#F8FAFC",
      textSecondary: "#CBD5E1",
      textTertiary: "#94A3B8",
      paper: "#111827",
      surface: "#1F2937",
      surfaceAlt: "#172554",
      primary: "#F8FAFC",
      accent: "#FB7185",
      accentBlue: "#22D3EE",
      yellow: "#FDE047",
      mint: "#4ADE80",
      danger: "#F87171",
      placeholder: "#64748B",
      separator: "#38BDF8",
      card: "#1F2937",
      tabIconDefault: "#94A3B8",
      onBright: "#111827",
      onPrimary: "#111827",
    },
    shape: {
      radiusSm: 8,
      radiusMd: 8,
      radiusLg: 8,
      borderWidthThin: 1,
      borderWidth: 2,
    },
    shadow: {
      color: "#22D3EE",
      opacity: 0.28,
      radius: 0,
      offsetY: 3,
    },
    typography: {
      displayShadowColor: "#FB7185",
      displayShadowOffset: { width: 3, height: 3 },
      displayShadowRadius: 0,
    },
    map: {
      paper: "#111827",
      overlayBlue: "rgba(34, 211, 238, 0.2)",
      overlayPink: "rgba(251, 113, 133, 0.18)",
      overlayYellow: "rgba(253, 224, 71, 0.12)",
      accentBlue: "#22D3EE",
      accentPink: "#FB7185",
      accentYellow: "#FDE047",
      buildingLow: "#164E63",
      buildingMid: "#075985",
      buildingHigh: "#7F1D1D",
      buildingTall: "#713F12",
      partyFill: "#A78BFA",
      partyShadow: "rgba(167,139,250,0.5)",
    },
  },
  neon: {
    id: "neon",
    name: "Neon",
    description:
      "Optimistischer Cyberpunk-Stil mit leuchtenden Akzenten, dunklem Glas, Tech-Kanten und Zukunftsstadt-Energie.",
    colors: {
      ink: "#EAFBFF",
      textSecondary: "#9EDBE9",
      textTertiary: "#5F95A8",
      paper: "#02070D",
      surface: "#07131F",
      surfaceAlt: "#081C2B",
      primary: "#EAFBFF",
      accent: "#FF2BD6",
      accentBlue: "#00F0FF",
      yellow: "#EFFF3A",
      mint: "#00FFB2",
      danger: "#FF3864",
      placeholder: "#426D80",
      separator: "#00F0FF",
      card: "#07131F",
      tabIconDefault: "#5F95A8",
      onBright: "#02070D",
      onPrimary: "#02070D",
    },
    shape: {
      radiusSm: 12,
      radiusMd: 16,
      radiusLg: 22,
      borderWidthThin: 1,
      borderWidth: 1,
    },
    shadow: {
      color: "#00F0FF",
      opacity: 0.18,
      radius: 18,
      offsetY: 10,
    },
    typography: {
      displayShadowColor: "#FF2BD6",
      displayShadowOffset: { width: 0, height: 0 },
      displayShadowRadius: 18,
    },
    map: {
      paper: "#01060B",
      overlayBlue: "rgba(0, 240, 255, 0.28)",
      overlayPink: "rgba(255, 43, 214, 0.24)",
      overlayYellow: "rgba(239, 255, 58, 0.14)",
      accentBlue: "#00F0FF",
      accentPink: "#FF2BD6",
      accentYellow: "#EFFF3A",
      buildingLow: "#071E35",
      buildingMid: "#003E5C",
      buildingHigh: "#5E106E",
      buildingTall: "#D9F92F",
      partyFill: "#FF2BD6",
      partyShadow: "rgba(255,43,214,0.68)",
    },
  },
};

export const ACTIVE_GRAPHIC_STYLE_ID: GraphicStyleId = "neon";
export const activeGraphicStyle = GRAPHIC_STYLES[ACTIVE_GRAPHIC_STYLE_ID];

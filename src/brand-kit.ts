export interface BrandKit {
  channelName: string;
  logo: string | null;
  primaryColor: string;
  accentColor: string;
  logoPosition: "TL" | "TR" | "BL" | "BR";
}

const BRAND_KIT_KEY = "vr-brand-kit";

const DEFAULT_BRAND_KIT: BrandKit = {
  channelName: "My Channel",
  logo: null,
  primaryColor: "#6c5ce7",
  accentColor: "#00cec9",
  logoPosition: "TL",
};

export const MAX_LOGO_SIZE = 500 * 1024;

export function loadBrandKit(): BrandKit {
  const raw = localStorage.getItem(BRAND_KIT_KEY);
  if (!raw) return { ...DEFAULT_BRAND_KIT };
  try {
    return { ...DEFAULT_BRAND_KIT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_BRAND_KIT };
  }
}

export function saveBrandKit(kit: BrandKit): boolean {
  try {
    localStorage.setItem(BRAND_KIT_KEY, JSON.stringify(kit));
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      return false;
    }
    return false;
  }
}

export function validateLogoFile(file: File): string | null {
  if (file.size > MAX_LOGO_SIZE) {
    return `Logo must be under 500KB (yours: ${Math.round(file.size / 1024)}KB)`;
  }
  if (file.type !== "image/png" && file.type !== "image/svg+xml") {
    return "Only PNG and SVG logos are supported";
  }
  return null;
}

export function readLogoAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const $ = (id: string) => document.getElementById(id)!;

export function initBrandKitPanel(): void {
  let kit = loadBrandKit();

  const panel = $("brandKitPanel");
  const toggle = $("settingsToggle");
  const close = $("settingsClose");

  // Toggle panel
  toggle.addEventListener("click", () => {
    panel.classList.toggle("hidden");
  });
  close.addEventListener("click", () => {
    panel.classList.add("hidden");
  });

  // Channel name
  const channelNameInput = $("channelNameInput") as HTMLInputElement;
  channelNameInput.value = kit.channelName;
  channelNameInput.addEventListener("input", () => {
    kit.channelName = channelNameInput.value || "My Channel";
    saveBrandKit(kit);
  });

  // Logo upload
  const logoInput = $("logoInput") as HTMLInputElement;
  const logoPreview = $("logoPreview") as HTMLImageElement;
  const logoRemove = $("logoRemove");
  const status = $("brandKitStatus");

  function updateLogoPreview() {
    if (kit.logo) {
      logoPreview.src = kit.logo;
      logoPreview.style.display = "block";
      logoRemove.style.display = "inline-flex";
    } else {
      logoPreview.style.display = "none";
      logoRemove.style.display = "none";
    }
  }

  logoInput.addEventListener("change", async () => {
    const file = logoInput.files?.[0];
    if (!file) return;

    const error = validateLogoFile(file);
    if (error) {
      status.textContent = error;
      status.className = "status error";
      return;
    }

    const dataUrl = await readLogoAsDataUrl(file);
    kit.logo = dataUrl;
    if (!saveBrandKit(kit)) {
      status.textContent = "Storage full — try a smaller logo";
      status.className = "status error";
      kit.logo = null;
      return;
    }
    status.textContent = "";
    updateLogoPreview();
  });

  logoRemove.addEventListener("click", () => {
    kit.logo = null;
    saveBrandKit(kit);
    logoInput.value = "";
    updateLogoPreview();
    status.textContent = "";
  });

  // Color pickers
  const primaryPicker = $("primaryColorPicker") as HTMLInputElement;
  const primaryHex = $("primaryColorHex") as HTMLInputElement;
  const accentPicker = $("accentColorPicker") as HTMLInputElement;
  const accentHex = $("accentColorHex") as HTMLInputElement;

  primaryPicker.addEventListener("input", () => {
    kit.primaryColor = primaryPicker.value;
    primaryHex.value = primaryPicker.value;
    saveBrandKit(kit);
  });
  primaryHex.addEventListener("change", () => {
    const val = primaryHex.value.startsWith("#") ? primaryHex.value : "#" + primaryHex.value;
    kit.primaryColor = val;
    primaryPicker.value = val;
    saveBrandKit(kit);
  });

  accentPicker.addEventListener("input", () => {
    kit.accentColor = accentPicker.value;
    accentHex.value = accentPicker.value;
    saveBrandKit(kit);
  });
  accentHex.addEventListener("change", () => {
    const val = accentHex.value.startsWith("#") ? accentHex.value : "#" + accentHex.value;
    kit.accentColor = val;
    accentPicker.value = val;
    saveBrandKit(kit);
  });

  // Position radios
  const positions: ("TL" | "TR" | "BL" | "BR")[] = ["TL", "TR", "BL", "BR"];
  for (const pos of positions) {
    const radio = $(`position${pos}`) as HTMLInputElement;
    radio.addEventListener("change", () => {
      if (radio.checked) {
        kit.logoPosition = pos;
        saveBrandKit(kit);
      }
    });
  }

  // Hydrate UI from stored kit
  primaryPicker.value = kit.primaryColor;
  primaryHex.value = kit.primaryColor;
  accentPicker.value = kit.accentColor;
  accentHex.value = kit.accentColor;
  const activeRadio = $(`position${kit.logoPosition}`) as HTMLInputElement;
  if (activeRadio) activeRadio.checked = true;
  updateLogoPreview();
}

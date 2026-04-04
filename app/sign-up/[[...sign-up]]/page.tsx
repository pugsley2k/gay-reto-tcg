import { SignUp } from "@clerk/nextjs";
import styles from "../../styles/AuthPage.module.css";

const clerkAppearance = {
  variables: {
    colorBackground: "#111128",
    colorText: "#f0f0ff",
    colorTextSecondary: "#c0c0e8",
    colorPrimary: "#b84fff",
    colorInputBackground: "#1c1c38",
    colorInputText: "#f0f0ff",
    colorNeutral: "#8080b8",
    borderRadius: "8px",
    fontFamily: "'Space Mono', monospace",
    fontSize: "14px",
  },
  elements: {
    card: {
      background: "#111128",
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 0 40px rgba(184,79,255,0.2), 0 20px 60px rgba(0,0,0,0.7)",
    },
    headerTitle: {
      color: "#ffffff",
      fontFamily: "'Space Mono', monospace",
      fontWeight: "700",
      fontSize: "1rem",
    },
    headerSubtitle: {
      color: "#c0c0e8",
    },
    socialButtonsBlockButton: {
      background: "#1c1c38",
      border: "1px solid rgba(255,255,255,0.12)",
      color: "#f0f0ff",
    },
    socialButtonsBlockButtonText: {
      color: "#f0f0ff",
      fontWeight: "600",
    },
    dividerLine: { background: "rgba(255,255,255,0.1)" },
    dividerText: { color: "#8080b8" },
    formFieldLabel: { color: "#c0c0e8", fontWeight: "600" },
    formFieldInput: {
      background: "#1c1c38",
      border: "1px solid rgba(255,255,255,0.12)",
      color: "#f0f0ff",
    },
    formButtonPrimary: {
      background: "linear-gradient(90deg, #ff3e6c, #ff8c42, #ffd166, #06d6a0, #118ab2, #b84fff)",
      fontFamily: "'Space Mono', monospace",
      fontSize: "0.8rem",
      fontWeight: "700",
      letterSpacing: "0.06em",
      border: "none",
    },
    footerActionText: { color: "#a0a0c8" },
    footerActionLink: { color: "#b84fff", fontWeight: "700" },
    identityPreviewText: { color: "#c0c0e8" },
    identityPreviewEditButton: { color: "#b84fff" },
  },
};

export default function SignUpPage() {
  return (
    <div className={styles.page}>
      <SignUp appearance={clerkAppearance} />
    </div>
  );
}

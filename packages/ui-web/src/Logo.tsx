import { brand } from "@fluxo/copy";
import { Icon } from "./Icon";

/** The Fluxo mark and wordmark. "sm" is the app sidebar, "lg" is the sign-in / landing size. */
export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  return size === "lg" ? (
    <div className="brand" style={{ gap: 12 }}>
      <div className="lm" style={{ width: 44, height: 44, borderRadius: 14 }}>
        <Icon name="wave" size={24} />
      </div>
      <span className="wordmark" style={{ fontSize: 32 }}>{brand.name}</span>
    </div>
  ) : (
    <div className="brand" style={{ padding: "0 6px" }}>
      <div className="lm">
        <Icon name="wave" size={20} />
      </div>
      <span className="wordmark">{brand.name}</span>
    </div>
  );
}

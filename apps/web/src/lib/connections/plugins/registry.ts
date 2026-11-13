/**
 * Phase 5 Module A — Plugin Registry.
 * Auto-registers all affiliate and social plugins at import time.
 */
import { pluginRegistry } from "./index";
import { amazonPlugin } from "./amazon";
import { clickbankPlugin } from "./clickbank";
import { digistorePlugin } from "./digistore";
import { impactPlugin } from "./impact";
import { cjPlugin } from "./cj";
import { shareasalePlugin } from "./shareasale";
import { instagramSocialPlugin } from "./instagram-social";
import { youtubeSocialPlugin } from "./youtube-social";
import { tiktokSocialPlugin } from "./tiktok-social";

// Register affiliate plugins
pluginRegistry.registerAffiliate(amazonPlugin);
pluginRegistry.registerAffiliate(clickbankPlugin);
pluginRegistry.registerAffiliate(digistorePlugin);
pluginRegistry.registerAffiliate(impactPlugin);
pluginRegistry.registerAffiliate(cjPlugin);
pluginRegistry.registerAffiliate(shareasalePlugin);

// Register social plugins
pluginRegistry.registerSocial(instagramSocialPlugin);
pluginRegistry.registerSocial(youtubeSocialPlugin);
pluginRegistry.registerSocial(tiktokSocialPlugin);

console.log(
  `[plugins] Registered ${pluginRegistry.listAffiliate().length} affiliate + ${pluginRegistry.listSocial().length} social plugins`
);

export * from "./index";
export * from "./amazon";
export * from "./clickbank";
export * from "./digistore";
export * from "./impact";
export * from "./cj";
export * from "./shareasale";
export * from "./instagram-social";
export * from "./youtube-social";
export * from "./tiktok-social";
# Changelog

## 1.14.0

- Added a unified `Qwen Voice` model entry that routes internally between built-in Qwen TTS, voice reference synthesis, and voice design synthesis.
- Added `Design` as a voice source mode. It uses an upstream text node as the voice design prompt while keeping the current node text as the spoken script.
- Renamed the custom voice source UI to `Voice ref` and kept it separate from `Design`.
- Added DashScope voice design support for Qwen Voice and CosyVoice, including custom voice metadata stored as `bragiCustomVoices`.
- Removed the separate user-facing Qwen Flash / Qwen VC / Qwen Instruct model entries in favor of the single Qwen Voice entry.
- Kept the Qwen built-in voice picker wired to the existing Instruct Flash sample list.
- Updated MCP generation to preserve voice source parameters such as `voiceMode` and `voiceDesignTextIndex`.
- Bumped the plugin version to `1.14.0`.


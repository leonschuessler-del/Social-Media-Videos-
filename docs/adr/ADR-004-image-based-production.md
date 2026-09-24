# ADR-004: Bildbasierte Produktion; KI-Video BLOCKED_BY_PROVIDER

**Status:** akzeptiert (erzwungen durch Marktlage)

**Kontext:** Vorgabe OpenAI-first. OpenAI hat Sora-App (26.04.2026) und Videos-API (24.09.2026) eingestellt; kein Nachfolger. Externe Video-Anbieter nur mit Freigabe.

**Entscheidung:** Szenen entstehen aus generierten Stills (OpenAI Images) + Kamera-Bewegung + programmatischen Infografiken/Textkarten + Schnitt. `VideoProvider`-Interface, Mock und Storyboard-Methoden (IMAGE_TO_VIDEO/TEXT_TO_VIDEO) bleiben erhalten; ohne freigegebenen Provider werden sie auf IMAGE_KENBURNS herabgestuft (Audit-Log).

**Folgen:** Kosten pro Video sinken drastisch; visueller „Wow“-Faktor hängt von Bildqualität und Sounddesign ab. Hero-Clips extern jederzeit nachrüstbar.

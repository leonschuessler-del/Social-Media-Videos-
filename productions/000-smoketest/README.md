# Smoke-Test-Fixture für `produce.sh`

Winzige, absichtlich künstliche Produktion (2 Sätze, ~9 s) zur schnellen Prüfung der
gesamten lokalen Pipeline (validate → voice → timeline → audio → render → mux → qa),
ohne einen echten 10-Minuten-Render zu starten. Nutzt die allgemeine `title_card`-Vorlage.

```bash
PY=<venv-python> TTS_MODEL=<modell-ordner> productions/tools/produce.sh \
  productions/000-smoketest --min-duration 1 --max-duration 60 --chunks 1
```

`out/` wird nicht versioniert (siehe `.gitignore`) und entsteht bei jedem Lauf neu.

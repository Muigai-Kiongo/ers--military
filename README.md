# M-TERS — Military Tactical Emergency Response System

A secure, web- and mobile-based platform designed to enhance force protection and tactical safety through encrypted real-time emergency assistance, combat medical guidance, and localized incident reporting.

Developed for the Joint Task Force Command – Thika Garrison to replace manual, radio-dependent emergency response with a fast, secure, and auditable digital system.

## The Problem

Emergency response at the garrison currently relies on:
- Manual VHF/UHF radio transmissions for Medevac requests — slow and vulnerable to interception or jamming.
- Manually read-out grid coordinates — prone to human error and delay.
- Physical TCCC (Tactical Combat Casualty Care) pocketbooks — easily lost, damaged, or unreadable in low light.
- Paper logbooks and whiteboards at the command center — no real-time overview of active emergencies.
- No secure channel for squad-level hazard reporting (IEDs, fires, accidents) without clogging the command radio net.

## What M-TERS Does

- **Encrypted real-time medical instructions** — offline-accessible, context-specific TCCC guidance for combat and training injuries, optimized for low-light and hands-free use.
- **Secure command & Medevac contact** — one-action encrypted alert to command or Medevac units, auto-attaching precise GPS coordinates and casualty status.
- **Tactical hazard & incident reporting** — personnel can report hazards or unusual events for squad and command-level awareness, separate from the primary radio net.
- **Command dashboard** — real-time, digitized view of active emergencies, incident reports, and unit status, replacing paper logbooks.
- **Role-based access** — Field Personnel, Combat Medics, and Command/Admin each get tailored views and permissions.

## Tech Stack

- **Backend:** Django, PostgreSQL
- **Frontend / Mobile:** React Native (with web-accessible companion)
- **Deployment:** Containerized, for infrastructure isolation

## Project Status

This is an early-stage build following an Agile development approach with 2–4 week sprints. Out of scope for this version: social media integration, predictive ML analytics.

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd mters

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend setup
cd ../frontend
npm install
npm start
```

Configure your `.env` files for database credentials and any API keys before running — see `.env.example` in each directory.

## Security Note

M-TERS is designed with OPSEC (operational security) as a core requirement: end-to-end encryption on all communications and data at rest, and minimal metadata exposure. Do not deploy to shared public infrastructure with default settings for production/live use — see deployment notes before going beyond demo/testing environments.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

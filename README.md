# IntelliGuard

IntelliGuard is an AI-powered facial recognition access control system developed as a final year project. The system uses facial embeddings generated with InsightFace to authenticate users and control access through an ESP32-CAM device.

The project consists of a modern Next.js application, a dedicated FastAPI AI service, PostgreSQL with pgvector for vector storage, and ESP32-CAM hardware for real-time image capture.

## Features

- AI-powered facial recognition
- Face embedding generation using InsightFace
- Real-time face verification
- ESP32-CAM integration
- Secure user registration
- Access logging
- Alert management
- Device management
- PostgreSQL vector database
- Modern web dashboard

## Tech Stack

### Frontend & Backend

- Next.js 16
- TypeScript
- React
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- Better Auth

### AI Service

- FastAPI
- InsightFace
- ONNX Runtime
- OpenCV
- NumPy

### Database

- PostgreSQL
- pgvector

### Hardware

- ESP32-CAM
- RGB LED
- Buzzer

## Project Architecture

Next.js
↓
API Routes
↓
FastAPI AI Service
↓
InsightFace
↓
PostgreSQL (pgvector)
↓
ESP32-CAM

## Status

🚧 Currently under active development.
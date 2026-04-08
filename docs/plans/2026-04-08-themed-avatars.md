# Themed Avatar Placeholders Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the generic `/icon.png` fallback with deterministic, initials-based themed avatars for users without a profile picture.

**Architecture:** Add a `getInitials()` and `getAvatarColor()` utility, update `UserAvatar` to render an initials circle when no image is available, and remove all 5 inline fallback patterns that bypass `UserAvatar`. Single source of truth, zero DB changes.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, Bun test runner

---

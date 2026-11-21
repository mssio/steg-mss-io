#!/bin/sh
# Vercel install step: Vercel's build image ships rustup but no wasm toolchain or wasm-pack.
set -eu
rustup toolchain install stable --profile minimal --target wasm32-unknown-unknown
rustup default stable
cargo install wasm-pack --version 0.15.1 --locked
export PATH="${CARGO_HOME:-$HOME/.cargo}/bin:$PATH"
wasm-pack --version
bun install --frozen-lockfile

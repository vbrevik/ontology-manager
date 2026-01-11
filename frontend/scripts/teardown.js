#!/usr/bin/env node

const fetch = globalThis.fetch || require('node-fetch')

async function main() {
  const prefix = process.argv[2] || 'e2e_user_'
  try {
    const res = await fetch('http://localhost:3000/api/test/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix }),
    })
    if (!res.ok) {
      console.error('Teardown failed', await res.text())
      process.exit(1)
    }
    console.log('Teardown completed')
  } catch (err) {
    console.error('Teardown error', err)
    process.exit(1)
  }
}

main()



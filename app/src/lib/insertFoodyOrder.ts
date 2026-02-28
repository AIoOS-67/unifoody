type OrderParams = {
  wallet_address: string
  amount_usdt: number
  foody_amount: number
}

export default async function insertFoodyOrder({
  wallet_address,
  amount_usdt,
  foody_amount,
}: OrderParams) {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address, amount_usdt, foody_amount }),
  })

  if (!res.ok) {
    const { error } = await res.json()
    throw new Error('Order insert failed: ' + error)
  }

  console.log('Order inserted:', { wallet_address, amount_usdt, foody_amount })
}

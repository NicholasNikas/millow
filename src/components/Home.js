import { ethers } from 'ethers'
import { useEffect, useState } from 'react'

import close from '../assets/close.svg'

const Home = ({ home, provider, escrow, togglePop, account }) => {
  const [buyer, setBuyer] = useState(null)
  const [lender, setLender] = useState(null)
  const [inspector, setInspector] = useState(null)
  const [seller, setSeller] = useState(null)
  const [owner, setOwner] = useState(null)

  const [hasBought, setHasBought] = useState(null)
  const [hasLended, setHasLended] = useState(null)
  const [hasInspected, setHasInspected] = useState(null)
  const [hasSold, setHasSold] = useState(null)

  const fetchDetails = async () => {
    const buyer = await escrow.buyer(home.id)
    setBuyer(buyer)

    const hasBought = await escrow.approval(home.id, buyer)
    setHasBought(hasBought)

    const seller = await escrow.seller()
    setSeller(seller)

    const hasSold = await escrow.approval(home.id, seller)
    setHasSold(hasSold)

    const lender = await escrow.lender()
    setLender(lender)

    const hasLended = await escrow.approval(home.id, lender)
    setHasLended(hasLended)

    const inspector = await escrow.inspector()
    setInspector(inspector)

    const hasInspected = await escrow.approval(home.id, inspector)
    setHasInspected(hasInspected)
  }

  const fetchOwner = async () => {
    if (await escrow.isListed(home.id)) return

    const owner = await escrow.buyer(home.id)
    setOwner(owner)
  }

  const buyHandler = async () => {
    const escrowAmount = await escrow.escrowAmount(home.id)
    const signer = await provider.getSigner()
    // buyer deposit earnest
    let transaction = await escrow
      .connect(signer)
      .depositEarnest(home.id, { value: escrowAmount })
    await transaction.wait()

    // buyer approves
    transaction = await escrow.connect(signer).approveSale(home.id)
    await transaction.wait()

    setHasBought(true)
  }

  const inspectHandler = async () => {
    const signer = await provider.getSigner()

    // inspector updates status
    const transaction = await escrow
      .connect(signer)
      .updateInspectionStatus(home.id, true)
    await transaction.wait()

    setHasInspected(true)
  }

  const lendHandler = async () => {
    const signer = await provider.getSigner()

    // lender approves
    const transaction = await escrow.connect(signer).approveSale(home.id)
    await transaction.wait()

    // lender sends funds to contract
    const lendAmount =
      (await escrow.purchasePrice(home.id)) -
      (await escrow.escrowAmount(home.id))

    await signer.sendTransaction({
      to: escrow.address,
      value: lendAmount.toString(),
      gasLimit: 60000,
    })

    setHasLended(true)
  }

  const sellHandler = async () => {
    const signer = await provider.getSigner()

    // seller approves
    let transaction = await escrow.connect(signer).approveSale(home.id)
    await transaction.wait()

    // seller finalize
    transaction = await escrow.connect(signer).finalizeSale(home.id)
    await transaction.wait()

    setHasSold(true)
  }

  useEffect(() => {
    fetchDetails()
    fetchOwner()
  }, [hasSold])

  return (
    <div className='home'>
      <div className='home__details'>
        <div className='home__image'>
          <img src={home.image} alt='Home' />
        </div>
        <div className='home__overview'>
          <h2>{home.name}</h2>
          <p>
            <strong>{home.attributes[2].value}</strong> bds |
            <strong>{home.attributes[3].value}</strong> ba |
            <strong>{home.attributes[4].value}</strong> sqft
          </p>
          <p>{home.address}</p>
          <h2>{home.attributes[0].value} ETH</h2>

          {owner ? (
            <div className='home__owned'>
              Owned by {owner.slice(0, 6) + '...' + owner.slice(38, 42)}
            </div>
          ) : (
            <div className=''>
              {account === inspector ? (
                <button
                  className='home__buy'
                  onClick={inspectHandler}
                  disabled={hasInspected}
                >
                  Approve Inspection
                </button>
              ) : account === lender ? (
                <button
                  className='home__buy'
                  onClick={lendHandler}
                  disabled={hasLended}
                >
                  Approve and lend
                </button>
              ) : account === seller ? (
                <button
                  className='home__buy'
                  onClick={sellHandler}
                  disabled={hasSold}
                >
                  Approve and sell
                </button>
              ) : (
                <button
                  className='home__buy'
                  onClick={buyHandler}
                  disabled={hasBought}
                >
                  Buy
                </button>
              )}
              <button className='home__contact'>Contact Agent</button>
            </div>
          )}

          <hr />
          <h2>Overview</h2>
          <p>{home.description}</p>
          <hr />
          <h3>Facts and Features</h3>
          <ul>
            {home.attributes.map((attribute, index) => (
              <li key={index}>
                <strong>{attribute.trait_type}</strong> : {attribute.value}
              </li>
            ))}
          </ul>
        </div>
        <button onClick={togglePop} className='home__close'>
          <img src={close} alt='Close' />
        </button>
      </div>
    </div>
  )
}

export default Home

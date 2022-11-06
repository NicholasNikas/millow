const { expect } = require('chai')
const { ethers } = require('hardhat')

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

describe('Escrow', () => {
  let realEstate, escrow, buyer, seller, inspector, lender

  beforeEach(async () => {
    ;[buyer, seller, inspector, lender] = await ethers.getSigners()

    const RealEstate = await ethers.getContractFactory('RealEstate')
    realEstate = await RealEstate.deploy()

    // Mint
    let transaction = await realEstate
      .connect(seller)
      .mint(
        'https://ipfs.io/ipfs/QmTudSYeM7mz3PkYEWXWqPjomRPHogcMFSq7XAvsvsgAPS'
      )
    await transaction.wait()

    const Escrow = await ethers.getContractFactory('Escrow')
    escrow = await Escrow.deploy(
      realEstate.address,
      seller.address,
      inspector.address,
      lender.address
    )

    // Approve property
    transaction = await realEstate.connect(seller).approve(escrow.address, 1)
    await transaction.wait()

    // List property
    transaction = await escrow
      .connect(seller)
      .list(1, buyer.address, tokens(10), tokens(5))
    await transaction.wait()
  })

  describe('Deployment', () => {
    it('Returns NFT address', async () => {
      const result = await escrow.nftAddress()
      expect(result).to.be.equal(realEstate.address)
    })

    it('Returns seller', async () => {
      const result = await escrow.seller()
      expect(result).to.be.equal(seller.address)
    })

    it('Returns inspector', async () => {
      const result = await escrow.inspector()
      expect(result).to.be.equal(inspector.address)
    })

    it('Returns lender', async () => {
      const result = await escrow.lender()
      expect(result).to.be.equal(lender.address)
    })
  })

  describe('Listing', () => {
    it('Updates as listed', async () => {
      expect(await escrow.isListed(1)).to.be.equal(true)
    })

    it('Updates ownership', async () => {
      expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address)
    })

    it('Returns buyer', async () => {
      expect(await escrow.buyer(1)).to.be.equal(buyer.address)
    })

    it('Returns purchase price', async () => {
      expect(await escrow.purchasePrice(1)).to.be.equal(tokens(10))
    })

    it('Returns escrow amount', async () => {
      expect(await escrow.escrowAmount(1)).to.be.equal(tokens(5))
    })
  })

  describe('Deposits', () => {
    it('Updates contract balance', async () => {
      const transaction = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) })
      await transaction.wait()
      const result = await escrow.getBalance()
      expect(result).to.be.equal(tokens(5))
    })
  })

  describe('Inspection', () => {
    it('Updates inspection status', async () => {
      const transaction = await escrow
        .connect(inspector)
        .updateInspectionStatus(1, true)
      await transaction.wait()
      expect(await escrow.inspectionPassed(1)).to.be.equal(true)
    })
  })

  describe('Approval', () => {
    it('Updates approval status', async () => {
      let transaction = await escrow.connect(buyer).approveSale(1)
      await transaction.wait()

      transaction = await escrow.connect(seller).approveSale(1)
      await transaction.wait()

      transaction = await escrow.connect(lender).approveSale(1)
      await transaction.wait()

      expect(await escrow.approval(1, buyer.address)).to.be.equal(true)
      expect(await escrow.approval(1, seller.address)).to.be.equal(true)
      expect(await escrow.approval(1, lender.address)).to.be.equal(true)
    })
  })

  describe('Sale', () => {
    beforeEach(async () => {
      let transaction = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) })
      await transaction.wait()

      transaction = await escrow
        .connect(inspector)
        .updateInspectionStatus(1, true)
      await transaction.wait()

      transaction = await escrow.connect(buyer).approveSale(1)
      await transaction.wait()

      transaction = await escrow.connect(seller).approveSale(1)
      await transaction.wait()

      transaction = await escrow.connect(lender).approveSale(1)
      await transaction.wait()

      await lender.sendTransaction({
        to: escrow.address,
        value: tokens(5),
      })
    })

    describe('Finalizes sale', () => {
      beforeEach(async () => {
        const transaction = await escrow.connect(seller).finalizeSale(1)
        await transaction.wait()
      })

      it('Updates balance', async () => {
        expect(await escrow.getBalance()).to.be.equal(0)
      })

      it('Updates isListed', async () => {
        expect(await escrow.isListed(1)).to.be.equal(false)
      })

      it('Updates ownership', async () => {
        expect(await realEstate.ownerOf(1)).to.be.equal(buyer.address)
      })
    })

    describe('Cancels sale', () => {
      it('Refunds buyer when inspection fails', async () => {
        const escrowBalanceBeforeRefund = await escrow.getBalance()
        const buyerBalanceBeforeRefund = await buyer.getBalance()

        let transaction = await escrow
          .connect(inspector)
          .updateInspectionStatus(1, false)
        await transaction.wait()

        transaction = await escrow.connect(seller).cancelSale(1)
        await transaction.wait()

        expect(await escrow.getBalance()).to.equal(0)
        expect(await buyer.getBalance()).to.equal(
          escrowBalanceBeforeRefund.add(buyerBalanceBeforeRefund)
        )
      })

      it('Refunds seller when inspection succeeds', async () => {
        const sellerBalanceBeforeRefund = await seller.getBalance()

        const transaction = await escrow.connect(seller).cancelSale(1)
        await transaction.wait()

        expect(await escrow.getBalance()).to.equal(0)
        expect(await seller.getBalance()).to.greaterThan(
          sellerBalanceBeforeRefund
        )
      })
    })
  })
})

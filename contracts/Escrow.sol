//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IERC721 {
    function transferFrom(
        address _from,
        address _to,
        uint256 _id
    ) external;
}

contract Escrow {
    address public nftAddress;
    address payable public seller;
    address public inspector;
    address public lender;

    modifier onlyInspector() {
        require(msg.sender == inspector, "Only inspector can call this method");
        _;
    }

    modifier onlyBuyer(uint256 _nftID) {
        require(msg.sender == buyer[_nftID], "Only buyer can call this method");
        _;
    }

    modifier onlySeller() {
        require(msg.sender == seller, "Only seller can call this method");
        _;
    }

    mapping(uint256 => bool) public isListed;
    mapping(uint256 => uint256) public purchasePrice;
    mapping(uint256 => uint256) public escrowAmount;
    mapping(uint256 => address) public buyer;
    mapping(uint256 => bool) public inspectionPassed;
    mapping(uint256 => mapping(address => bool)) public approval;

    constructor(address _nftAddress, address payable _seller, address _inspector, address _lender) {
        nftAddress = _nftAddress;
        seller = _seller;
        inspector = _inspector;
        lender = _lender;
    }

    function list(
        uint256 _nftID, 
        address _buyer, 
        uint256 _purchasePrice, 
        uint256 _escrowAmount
        ) public payable onlySeller {
        IERC721(nftAddress).transferFrom(msg.sender, address(this), _nftID);

        isListed[_nftID] = true;
        purchasePrice[_nftID] = _purchasePrice;
        escrowAmount[_nftID] = _escrowAmount;
        buyer[_nftID] = _buyer;
    }

    // Put under contract (only buyer - payable escrow)
    function depositEarnest(uint256 _nftID) public payable onlyBuyer(_nftID) {
        require(msg.value >= escrowAmount[_nftID]);
    }

    function updateInspectionStatus(uint256 _nftID, bool _passed) public onlyInspector {
        inspectionPassed[_nftID] = _passed;
    }

    function approveSale(uint256 _nftID) public {
        approval[_nftID][msg.sender] = true;
    }

    // Finalize sale
    // 1 - Require inspection status (add more items here, like appraisal)
    // 2 - Require sale to be authroized
    // 3 - Require funds to be correct amount
    // 4 - Transfer NFT to buyer
    // 5 - Transfer Funds to seller
    function finalizeSale(uint256 _nftID) public {
        require(inspectionPassed[_nftID] == true, "Inspection has not passed");
        require(approval[_nftID][buyer[_nftID]] == true, "Sale has not been authorized by buyer");
        require(approval[_nftID][seller] == true, "Sale has not been authorized by seller");
        require(approval[_nftID][lender] == true, "Sale has not been authorized by lender");
        require(address(this).balance >= purchasePrice[_nftID], "Incorrect funds");

        isListed[_nftID] = false;

        (bool success, ) = payable(seller).call{ value: address(this).balance }("");
        require(success, "Transfer of funds to seller unsuccessful");

        IERC721(nftAddress).transferFrom(address(this), buyer[_nftID], _nftID);
    }

    // If inspection status is not approved, then refund, otherwise send to seller
    function cancelSale(uint256 _nftID) public {
        require(isListed[_nftID] == true, "Property is not listed");

        if (inspectionPassed[_nftID] == false) {
            payable(buyer[_nftID]).transfer(address(this).balance);
        } else {
            payable(seller).transfer(address(this).balance);
        }
    }

    receive() external payable {}

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}

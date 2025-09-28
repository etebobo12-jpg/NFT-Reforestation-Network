import { describe, it, expect, beforeEach } from "vitest";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_LOCATION = 101;
const ERR_INVALID_TREE_COUNT = 102;
const ERR_INVALID_PLANT_DATE = 103;
const ERR_TOKEN_NOT_FOUND = 105;
const ERR_MAX_TOKENS_EXCEEDED = 117;
const ERR_INVALID_COORDINATES = 113;
const ERR_INVALID_SPECIES = 114;
const ERR_INVALID_CARBON_ESTIMATE = 115;
const ERR_INVALID_PARTNER_ID = 116;
const ERR_OWNER_ONLY = 119;
const ERR_AUTHORITY_NOT_VERIFIED = 111;

interface PlotMetadata {
  location: string;
  coordinates: { lat: number; long: number };
  treeCount: number;
  plantDate: number;
  species: string;
  carbonEstimate: number;
  partnerId: number;
  status: boolean;
  owner: string;
}

interface PlotUpdate {
  updateLocation: string;
  updateTreeCount: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class PlotNFTMock {
  state: {
    lastTokenId: number;
    maxTokens: number;
    mintFee: number;
    authorityContract: string | null;
    contractOwner: string;
    plotMetadata: Map<number, PlotMetadata>;
    plotUpdates: Map<number, PlotUpdate>;
    nftOwners: Map<number, string>;
  } = {
    lastTokenId: 0,
    maxTokens: 10000,
    mintFee: 500,
    authorityContract: null,
    contractOwner: "ST1TEST",
    plotMetadata: new Map(),
    plotUpdates: new Map(),
    nftOwners: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      lastTokenId: 0,
      maxTokens: 10000,
      mintFee: 500,
      authorityContract: null,
      contractOwner: "ST1TEST",
      plotMetadata: new Map(),
      plotUpdates: new Map(),
      nftOwners: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.caller !== this.state.contractOwner) {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMaxTokens(newMax: number): Result<boolean> {
    if (this.caller !== this.state.contractOwner) {
      return { ok: false, value: false };
    }
    if (newMax <= 0) {
      return { ok: false, value: false };
    }
    if (!this.state.authorityContract) {
      return { ok: false, value: false };
    }
    this.state.maxTokens = newMax;
    return { ok: true, value: true };
  }

  setMintFee(newFee: number): Result<boolean> {
    if (this.caller !== this.state.contractOwner) {
      return { ok: false, value: false };
    }
    if (newFee < 0) {
      return { ok: false, value: false };
    }
    if (!this.state.authorityContract) {
      return { ok: false, value: false };
    }
    this.state.mintFee = newFee;
    return { ok: true, value: true };
  }

  mintPlot(
    location: string,
    coordinates: { lat: number; long: number },
    treeCount: number,
    plantDate: number,
    species: string,
    carbonEstimate: number,
    partnerId: number,
    status: boolean
  ): Result<number> {
    const nextId = this.state.lastTokenId + 1;
    if (nextId > this.state.maxTokens) return { ok: false, value: ERR_MAX_TOKENS_EXCEEDED };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (coordinates.lat < -90 || coordinates.lat > 90 || coordinates.long < -180 || coordinates.long > 180) return { ok: false, value: ERR_INVALID_COORDINATES };
    if (treeCount <= 0 || treeCount > 10000) return { ok: false, value: ERR_INVALID_TREE_COUNT };
    if (plantDate > this.blockHeight) return { ok: false, value: ERR_INVALID_PLANT_DATE };
    if (!species || species.length > 50) return { ok: false, value: ERR_INVALID_SPECIES };
    if (carbonEstimate < 0) return { ok: false, value: ERR_INVALID_CARBON_ESTIMATE };
    if (partnerId <= 0) return { ok: false, value: ERR_INVALID_PARTNER_ID };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.mintFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.lastTokenId + 1;
    const metadata: PlotMetadata = {
      location,
      coordinates,
      treeCount,
      plantDate,
      species,
      carbonEstimate,
      partnerId,
      status,
      owner: this.caller,
    };
    this.state.plotMetadata.set(id, metadata);
    this.state.nftOwners.set(id, this.caller);
    this.state.lastTokenId = id;
    return { ok: true, value: id };
  }

  transferPlot(tokenId: number, recipient: string): Result<boolean> {
    if (!this.state.nftOwners.has(tokenId)) return { ok: false, value: false };
    if (this.state.nftOwners.get(tokenId) !== this.caller) return { ok: false, value: false };
    this.state.nftOwners.set(tokenId, recipient);
    const metadata = this.state.plotMetadata.get(tokenId);
    if (metadata) {
      this.state.plotMetadata.set(tokenId, { ...metadata, owner: recipient });
    }
    return { ok: true, value: true };
  }

  updatePlot(tokenId: number, updateLocation: string, updateTreeCount: number): Result<boolean> {
    const metadata = this.state.plotMetadata.get(tokenId);
    if (!metadata) return { ok: false, value: false };
    if (metadata.owner !== this.caller) return { ok: false, value: false };
    if (!updateLocation || updateLocation.length > 100) return { ok: false, value: false };
    if (updateTreeCount <= 0 || updateTreeCount > 10000) return { ok: false, value: false };

    const updated: PlotMetadata = {
      ...metadata,
      location: updateLocation,
      treeCount: updateTreeCount,
    };
    this.state.plotMetadata.set(tokenId, updated);
    this.state.plotUpdates.set(tokenId, {
      updateLocation,
      updateTreeCount,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  burnPlot(tokenId: number): Result<boolean> {
    if (!this.state.nftOwners.has(tokenId)) return { ok: false, value: false };
    if (this.state.nftOwners.get(tokenId) !== this.caller) return { ok: false, value: false };
    this.state.nftOwners.delete(tokenId);
    this.state.plotMetadata.delete(tokenId);
    this.state.plotUpdates.delete(tokenId);
    return { ok: true, value: true };
  }

  getPlotDetails(tokenId: number): PlotMetadata | null {
    return this.state.plotMetadata.get(tokenId) || null;
  }

  getTokenCount(): Result<number> {
    return { ok: true, value: this.state.lastTokenId };
  }

  getOwner(tokenId: number): Result<string | null> {
    return { ok: true, value: this.state.nftOwners.get(tokenId) || null };
  }
}

describe("PlotNFT", () => {
  let contract: PlotNFTMock;

  beforeEach(() => {
    contract = new PlotNFTMock();
    contract.reset();
  });

  it("rejects invalid location", () => {
    contract.setAuthorityContract("ST2TEST");
    const longLocation = "A".repeat(101);
    const result = contract.mintPlot(
      longLocation,
      { lat: 40, long: -75 },
      100,
      1000,
      "Oak",
      500,
      1,
      true
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_LOCATION);
  });

  it("rejects invalid coordinates", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.mintPlot(
      "ForestA",
      { lat: 91, long: -75 },
      100,
      1000,
      "Oak",
      500,
      1,
      true
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_COORDINATES);
  });

  it("rejects invalid tree count", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.mintPlot(
      "ForestA",
      { lat: 40, long: -75 },
      0,
      1000,
      "Oak",
      500,
      1,
      true
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TREE_COUNT);
  });

  it("rejects invalid plant date", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.blockHeight = 500;
    const result = contract.mintPlot(
      "ForestA",
      { lat: 40, long: -75 },
      100,
      600,
      "Oak",
      500,
      1,
      true
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PLANT_DATE);
  });

  it("rejects transfer of non-existent plot", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.transferPlot(99, "ST3RECIPIENT");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update for non-existent plot", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updatePlot(99, "ForestB", 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects burn of non-existent plot", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.burnPlot(99);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects mint fee change without authority contract", () => {
    const result = contract.setMintFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});
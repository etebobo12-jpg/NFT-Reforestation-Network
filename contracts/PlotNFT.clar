(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-LOCATION u101)
(define-constant ERR-INVALID-TREE-COUNT u102)
(define-constant ERR-INVALID-PLANT-DATE u103)
(define-constant ERR-INVALID-OWNER u104)
(define-constant ERR-TOKEN-NOT-FOUND u105)
(define-constant ERR-TRANSFER-NOT-ALLOWED u106)
(define-constant ERR-MINT-LIMIT-EXCEEDED u107)
(define-constant ERR-INVALID-UPDATE-PARAM u108)
(define-constant ERR-UPDATE-NOT-ALLOWED u109)
(define-constant ERR-INVALID-METADATA u110)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u111)
(define-constant ERR-INVALID-STATUS u112)
(define-constant ERR-INVALID-COORDINATES u113)
(define-constant ERR-INVALID-SPECIES u114)
(define-constant ERR-INVALID-CARBON-ESTIMATE u115)
(define-constant ERR-INVALID-PARTNER-ID u116)
(define-constant ERR-MAX-TOKENS-EXCEEDED u117)
(define-constant ERR-INVALID-TOKEN-ID u118)
(define-constant ERR-OWNER-ONLY u119)
(define-constant ERR-BURN-NOT-ALLOWED u120)

(define-non-fungible-token plot-nft uint)

(define-data-var last-token-id uint u0)
(define-data-var max-tokens uint u10000)
(define-data-var mint-fee uint u500)
(define-data-var authority-contract (optional principal) none)
(define-data-var contract-owner principal tx-sender)

(define-map plot-metadata
  { token-id: uint }
  {
    location: (string-ascii 100),
    coordinates: (tuple { lat: int, long: int }),
    tree-count: uint,
    plant-date: uint,
    species: (string-ascii 50),
    carbon-estimate: uint,
    partner-id: uint,
    status: bool,
    owner: principal
  }
)

(define-map plot-updates
  { token-id: uint }
  {
    update-location: (string-ascii 100),
    update-tree-count: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-plot-details (token-id uint))
  (map-get? plot-metadata { token-id: token-id })
)

(define-read-only (get-plot-updates (token-id uint))
  (map-get? plot-updates { token-id: token-id })
)

(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? plot-nft token-id))
)

(define-private (validate-location (loc (string-ascii 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-coordinates (coords (tuple { lat: int, long: int })))
  (let ((lat (get lat coords)) (long (get long coords)))
    (if (and (>= lat -90) (<= lat 90) (>= long -180) (<= long 180))
        (ok true)
        (err ERR-INVALID-COORDINATES))
  )
)

(define-private (validate-tree-count (count uint))
  (if (and (> count u0) (<= count u10000))
      (ok true)
      (err ERR-INVALID-TREE-COUNT))
)

(define-private (validate-plant-date (date uint))
  (if (<= date block-height)
      (ok true)
      (err ERR-INVALID-PLANT-DATE))
)

(define-private (validate-species (spec (string-ascii 50)))
  (if (and (> (len spec) u0) (<= (len spec) u50))
      (ok true)
      (err ERR-INVALID-SPECIES))
)

(define-private (validate-carbon-estimate (est uint))
  (if (>= est u0)
      (ok true)
      (err ERR-INVALID-CARBON-ESTIMATE))
)

(define-private (validate-partner-id (pid uint))
  (if (> pid u0)
      (ok true)
      (err ERR-INVALID-PARTNER-ID))
)

(define-private (validate-status (stat bool))
  (ok true)
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-OWNER-ONLY))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-tokens (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-OWNER-ONLY))
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-tokens new-max)
    (ok true)
  )
)

(define-public (set-mint-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-OWNER-ONLY))
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set mint-fee new-fee)
    (ok true)
  )
)

(define-public (mint-plot
  (location (string-ascii 100))
  (coordinates (tuple { lat: int, long: int }))
  (tree-count uint)
  (plant-date uint)
  (species (string-ascii 50))
  (carbon-estimate uint)
  (partner-id uint)
  (status bool)
)
  (let (
        (next-id (+ (var-get last-token-id) u1))
        (current-max (var-get max-tokens))
        (authority (var-get authority-contract))
      )
    (asserts! (<= next-id current-max) (err ERR-MAX-TOKENS-EXCEEDED))
    (try! (validate-location location))
    (try! (validate-coordinates coordinates))
    (try! (validate-tree-count tree-count))
    (try! (validate-plant-date plant-date))
    (try! (validate-species species))
    (try! (validate-carbon-estimate carbon-estimate))
    (try! (validate-partner-id partner-id))
    (try! (validate-status status))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get mint-fee) tx-sender authority-recipient))
    )
    (try! (nft-mint? plot-nft next-id tx-sender))
    (map-set plot-metadata { token-id: next-id }
      {
        location: location,
        coordinates: coordinates,
        tree-count: tree-count,
        plant-date: plant-date,
        species: species,
        carbon-estimate: carbon-estimate,
        partner-id: partner-id,
        status: status,
        owner: tx-sender
      }
    )
    (var-set last-token-id next-id)
    (print { event: "plot-minted", id: next-id })
    (ok next-id)
  )
)

(define-public (transfer-plot (token-id uint) (recipient principal))
  (begin
    (asserts! (is-some (nft-get-owner? plot-nft token-id)) (err ERR-TOKEN-NOT-FOUND))
    (asserts! (is-eq tx-sender (unwrap! (nft-get-owner? plot-nft token-id) (err ERR-TOKEN-NOT-FOUND))) (err ERR-NOT-AUTHORIZED))
    (try! (nft-transfer? plot-nft token-id tx-sender recipient))
    (map-set plot-metadata { token-id: token-id }
      (merge (unwrap! (map-get? plot-metadata { token-id: token-id }) (err ERR-TOKEN-NOT-FOUND))
        { owner: recipient }
      )
    )
    (print { event: "plot-transferred", id: token-id, to: recipient })
    (ok true)
  )
)

(define-public (update-plot
  (token-id uint)
  (update-location (string-ascii 100))
  (update-tree-count uint)
)
  (let ((metadata (map-get? plot-metadata { token-id: token-id })))
    (match metadata
      m
        (begin
          (asserts! (is-eq (get owner m) tx-sender) (err ERR-OWNER-ONLY))
          (try! (validate-location update-location))
          (try! (validate-tree-count update-tree-count))
          (map-set plot-metadata { token-id: token-id }
            (merge m
              {
                location: update-location,
                tree-count: update-tree-count
              }
            )
          )
          (map-set plot-updates { token-id: token-id }
            {
              update-location: update-location,
              update-tree-count: update-tree-count,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "plot-updated", id: token-id })
          (ok true)
        )
      (err ERR-TOKEN-NOT-FOUND)
    )
  )
)

(define-public (burn-plot (token-id uint))
  (begin
    (asserts! (is-some (nft-get-owner? plot-nft token-id)) (err ERR-TOKEN-NOT-FOUND))
    (asserts! (is-eq tx-sender (unwrap! (nft-get-owner? plot-nft token-id) (err ERR-TOKEN-NOT-FOUND))) (err ERR-NOT-AUTHORIZED))
    (try! (nft-burn? plot-nft token-id tx-sender))
    (map-delete plot-metadata { token-id: token-id })
    (map-delete plot-updates { token-id: token-id })
    (print { event: "plot-burned", id: token-id })
    (ok true)
  )
)

(define-public (get-token-count)
  (ok (var-get last-token-id))
)
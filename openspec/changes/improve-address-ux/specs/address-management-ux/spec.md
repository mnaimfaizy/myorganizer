## ADDED Requirements

### Requirement: Private drawer address creation

The system SHALL provide a drawer-based address creation flow that keeps existing addresses visible and stores new addresses only through the encrypted vault persistence path.

#### Scenario: Opening the creation drawer

- **WHEN** an unlocked user selects the add address action from the address page
- **THEN** the system opens an accessible drawer containing the address form, validation messages, and a live address preview

#### Scenario: Saving a valid address

- **WHEN** the user submits a valid non-duplicate address
- **THEN** the system saves the address to the encrypted `addresses` vault blob and shows the saved address in the list

### Requirement: Offline address validation and defaults

The system SHALL validate address entry offline using local rules and default the selected country from account settings when available.

#### Scenario: Invalid required fields

- **WHEN** the user leaves required address fields empty or enters an invalid postal code shape
- **THEN** the system displays inline field errors and prevents saving until the input is valid

#### Scenario: Account country default

- **WHEN** the address form opens for a user with account country settings
- **THEN** the system preselects that country without sending address text to an external provider

### Requirement: Duplicate address review

The system SHALL detect likely duplicate addresses in browser memory and require an explicit override before saving a matching address.

#### Scenario: Matching existing address

- **WHEN** the user enters an address whose normalized address fields match an existing address
- **THEN** the system displays a duplicate warning with the existing address context and does not save immediately

#### Scenario: Duplicate override

- **WHEN** the user confirms saving despite the duplicate warning
- **THEN** the system saves the new address to the encrypted `addresses` vault blob

### Requirement: Address list usability

The system SHALL make the address list easier to scan and operate through summary counts, search/filter controls, empty-state guidance, and visible touch-accessible actions.

#### Scenario: Filtering addresses

- **WHEN** the user searches by label, address text, or country
- **THEN** the system filters the visible address list without modifying saved vault data

#### Scenario: Empty address list

- **WHEN** the user has no saved addresses
- **THEN** the system shows an empty state with a clear add address action

### Requirement: Usage-location validation

The system SHALL validate address usage-location entries with inline feedback and warn when an organisation is already attached to the same address.

#### Scenario: Invalid usage-location link

- **WHEN** the user enters a malformed usage-location link
- **THEN** the system displays an inline URL validation error and prevents saving

#### Scenario: Duplicate usage-location organisation

- **WHEN** the user enters an organisation name that already exists on the same address
- **THEN** the system displays a duplicate organisation warning before save

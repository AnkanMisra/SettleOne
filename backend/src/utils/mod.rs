//! Utility functions

/// Format an Ethereum address for display
pub fn format_address(address: &str, chars: usize) -> String {
    if address.len() < chars * 2 + 2 {
        return address.to_string();
    }
    format!(
        "{}...{}",
        &address[..chars + 2],
        &address[address.len() - chars..]
    )
}

/// Validate Ethereum address format
pub fn is_valid_address(address: &str) -> bool {
    if !address.starts_with("0x") {
        return false;
    }
    if address.len() != 42 {
        return false;
    }
    address[2..].chars().all(|c| c.is_ascii_hexdigit())
}

/// Validate ENS name format
pub fn is_valid_ens(name: &str) -> bool {
    if !name.ends_with(".eth") {
        return false;
    }
    if name.len() < 7 {
        // minimum: a.eth (5) but typical minimum is 3 chars + .eth
        return false;
    }
    let label = &name[..name.len() - 4];
    label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_address() {
        let addr = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
        assert_eq!(format_address(addr, 4), "0xd8dA...6045");
    }

    #[test]
    fn test_is_valid_address() {
        assert!(is_valid_address(
            "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        ));
        assert!(!is_valid_address("0xinvalid"));
        assert!(!is_valid_address("not_an_address"));
    }

    #[test]
    fn test_is_valid_ens() {
        assert!(is_valid_ens("vitalik.eth"));
        assert!(is_valid_ens("my-name.eth"));
        assert!(!is_valid_ens("invalid"));
        assert!(!is_valid_ens("ab.eth")); // too short
    }
}

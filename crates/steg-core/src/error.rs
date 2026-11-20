use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StegError {
    NotFound,
    TooLarge,
    Unsupported,
    TooSmall,
    TooLong(u32),
    EmptyMessage,
    EmptyPassword,
}

impl fmt::Display for StegError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound => f.write_str("No message found, or the password is wrong."),
            Self::TooLarge => f.write_str("Image is too large (max 40 megapixels)."),
            Self::Unsupported => f.write_str("Only PNG and JPEG images are supported."),
            Self::TooSmall => f.write_str("This image is too small to hold a message."),
            Self::TooLong(n) => write!(f, "This image can hold at most {n} characters."),
            Self::EmptyMessage => f.write_str("Enter a message."),
            Self::EmptyPassword => f.write_str("Enter a password."),
        }
    }
}

impl std::error::Error for StegError {}

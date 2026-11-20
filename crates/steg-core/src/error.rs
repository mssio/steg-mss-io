use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StegError {
    NotFound,
    TooLarge,
    Unsupported,
    TooSmall,
    TooLong(u32),
    TooLongBytes(u32),
    EmptyMessage,
    EmptyPassword,
    Internal,
}

impl fmt::Display for StegError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound => f.write_str("No message found, or the password is wrong."),
            Self::TooLarge => f.write_str("Image is too large (max 40 megapixels)."),
            Self::Unsupported => f.write_str("Only PNG and JPEG images are supported."),
            Self::TooSmall => f.write_str("This image is too small to hold a message."),
            Self::TooLong(n) => write!(f, "This image can hold at most {n} characters."),
            Self::TooLongBytes(n) => {
                write!(f, "This message is too long for this image (max {n} bytes).")
            }
            Self::EmptyMessage => f.write_str("Enter a message."),
            Self::EmptyPassword => f.write_str("Enter a password."),
            Self::Internal => f.write_str("Something went wrong. Please try again."),
        }
    }
}

impl std::error::Error for StegError {}

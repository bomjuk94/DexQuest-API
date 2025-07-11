function validateRegistrationInput({ username, email, password }) {
    const errors = [];

    if (!username || !email || !password) {
        errors.push("Username, email, and password required.");
    }

    if (!username || typeof username !== "string" || username.trim().length < 3) {
        errors.push("Username must be at least 3 characters.");
    }

    if (!email || typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
        errors.push("A valid email is required.");
    }

    if (!password || typeof password !== "string" || password.length < 6) {
        errors.push("Password must be at least 6 characters.");
    }

    return errors;
}

function validateLoginInputs({ username, password }) {
    const errors = []

    if (!username || typeof username !== "string") {
        errors.push("Username is required.");
    } else if (username.trim().length < 3) {
        errors.push("Username must be at least 3 characters.");
    }

    if (!password || typeof password !== "string") {
        errors.push("Password is required.");
    } else if (password.trim().length === 0) {
        errors.push("Password cannot be empty.");
    }

    return errors
}

function validateProfileUpdateInput({ username, email, password }) {
    const errors = [];

    if (username !== undefined) {
        if (typeof username !== "string" || username.trim().length < 3) {
            errors.push("Username must be at least 3 characters.");
        }
    }

    if (email !== undefined) {
        if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
            errors.push("A valid email is required.");
        }
    }

    if (password !== undefined) {
        if (typeof password !== "string" || password.length < 6) {
            errors.push("Password must be at least 6 characters.");
        }
    }

    if (username === undefined && email === undefined && password === undefined) {
        errors.push("At least one field must be provided to update.");
    }

    return errors;
}


module.exports = {
    validateRegistrationInput,
    validateLoginInputs,
    validateProfileUpdateInput,
};

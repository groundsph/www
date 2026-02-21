import { Database } from './database.types';
import { OperatingHours, CafeSocial } from './cafe';

export type EditSuggestionStatus = 'pending' | 'approved' | 'rejected';

// What fields can be suggested for editing
export interface SuggestableFields {
    name?: string;
    description?: string;
    address_display?: string;
    area?: string;
    lat?: number;
    lng?: number;
    phone?: string;
    email?: string;
    website_url?: string;
    has_wifi?: boolean;
    has_smoking?: boolean;

    has_sockets?: boolean;
    has_parking?: boolean;
    has_aircon?: boolean;
    is_pet_friendly?: boolean;
    has_outdoor_seating?: boolean;
    has_indoor_seating?: boolean;
    has_restroom?: boolean;
    has_bidet?: boolean;
    has_non_dairy?: boolean;
    has_decaf?: boolean;
    milk_options?: string[];
    serves_food?: boolean;
    is_work_friendly?: boolean;
    price_level?: Database['public']['Enums']['price_level'];
    coffee_style?: Database['public']['Enums']['coffee_style'];
    payment_methods?: string;
    specialty?: string[];
    tags?: string[];
    brew_methods?: string[];
    roaster?: string;
    operating_hours?: OperatingHours;
    socials?: CafeSocial[];
    is_hidden_gem?: boolean;
    finding_hint?: string;
    is_chain?: boolean;
    is_halal_certified?: boolean;
    straw_type?: string;
    straw_type_other?: string;
}

export interface SuggestedImageChanges {
    add_to_gallery?: string[];      // URLs of images to add
    remove_from_gallery?: string[]; // URLs of images to remove
    new_thumbnail?: string;         // URL of suggested new thumbnail
}

export interface EditSuggestion {
    id: string;
    cafe_id: string;
    user_id: string;
    status: EditSuggestionStatus;
    suggested_changes: SuggestableFields;
    suggested_images: SuggestedImageChanges | null;
    admin_notes: string | null;
    created_at: string | null;
    updated_at: string | null;
    reviewed_at: string | null;
    reviewed_by: string | null;
    // Joined data for display
    cafe?: {
        id: string;
        name: string;
        slug: string;
        thumbnail: string;
    };
    author?: {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
    };
}

// Form data for submitting a suggestion (before image upload)
export interface EditSuggestionFormData {
    changes: SuggestableFields;
    newGalleryImages?: File[];
    removeGalleryImages?: string[];
    newThumbnail?: File;
}

import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
    Tailwind,
} from "@react-email/components"

interface ContactEmailProps {
    name: string
    email: string
    subject: string
    message: string
}

// Custom Tailwind config with Grounds colors (matching global.css)
const tailwindConfig = {
    theme: {
        extend: {
            colors: {
                primary: "#74512d",
                secondary: "#af8f6f",
                tertiary: "#f8f4e1",
                background: "#f8f4e1",
                text: "#543310",
            },
        },
    },
}

export default function ContactEmail({
    name,
    email,
    subject,
    message,
}: ContactEmailProps) {
    return (
        <Html>
            <Preview>
                New contact from {name}: {subject}
            </Preview>
            <Tailwind config={tailwindConfig}>
                <Head />
                <Body className='bg-tertiary font-sans'>
                    <Container className='mx-auto py-12 px-4 max-w-xl'>
                        {/* Header */}
                        <Section className='text-center mb-8'>
                            <Heading className='text-4xl font-bold text-primary font-serif m-0'>
                                GroundsPH
                            </Heading>
                        </Section>

                        {/* Main Card */}
                        <Section className='bg-white rounded-2xl p-8 shadow-lg'>
                            <Heading className='text-2xl font-semibold text-text mt-0 mb-4'>
                                New Contact Message
                            </Heading>

                            <Text className='text-secondary text-sm mb-2'>
                                From
                            </Text>
                            <Text className='text-text text-base font-medium mt-0 mb-4'>
                                {name} ({email})
                            </Text>

                            <Text className='text-secondary text-sm mb-2'>
                                Subject
                            </Text>
                            <Text className='text-text text-base font-medium mt-0 mb-4'>
                                {subject}
                            </Text>

                            <Text className='text-secondary text-sm mb-2'>
                                Message
                            </Text>
                            <Text className='text-text text-base leading-relaxed mt-0 mb-0 whitespace-pre-wrap'>
                                {message}
                            </Text>
                        </Section>

                        {/* Footer */}
                        <Section className='text-center mt-8'>
                            <Hr className='border-secondary my-6' />
                            <Text className='text-secondary text-sm m-0'>
                                © {new Date().getFullYear()} GroundsPH. All rights
                                reserved.
                            </Text>
                            <Text className='text-secondary text-xs mt-2'>
                                This message was sent via the GroundsPH contact
                                form.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}

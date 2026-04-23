import { createElement, forwardRef, type ComponentProps, type ElementRef } from 'react';
import { createNavigation } from 'next-intl/navigation';

import { routing } from '@/i18n/routing';

const navigation = createNavigation(routing);
const NavigationLink = navigation.Link;

export const Link = forwardRef<ElementRef<typeof NavigationLink>, ComponentProps<typeof NavigationLink>>(
  function Link({ prefetch = false, ...props }, ref) {
    return createElement(NavigationLink, { ...props, prefetch, ref });
  },
);

Link.displayName = 'Link';

export const { redirect, usePathname, useRouter, getPathname } = navigation;

